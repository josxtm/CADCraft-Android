"""No model/API calls. Real temporary Git branches + simulated PR/check services."""
import copy
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest import mock

from task_queue import (Blocked, Repairable, Commands, Engine, Services, Store,
                        atomic_json, check_gate, load_config, main, redact)


ROOT = Path(__file__).resolve().parents[1]


def config():
    result = json.loads((ROOT / 'automation/queue.json').read_text())
    result['repository'] = 'owner/repo'
    result['required_checks'] = ['unit', 'integration']
    result['tasks'] = [
        {'issue': 11, 'priority': 10, 'depends_on': [], 'state': 'pending'},
        {'issue': 12, 'priority': 20, 'depends_on': [11], 'base_task': 11, 'state': 'pending'},
    ]
    return result


def pr(sha='a' * 40):
    return {'headRefOid': sha, 'state': 'OPEN', 'isDraft': True,
            'statusCheckRollup': [
                {'__typename': 'CheckRun', 'name': name, 'status': 'COMPLETED', 'conclusion': 'SUCCESS'}
                for name in ['unit', 'integration']
            ] + [{'__typename': 'CheckRun', 'name': 'android', 'status': 'COMPLETED', 'conclusion': 'SKIPPED'}]}


def git(repo, *args):
    return subprocess.check_output(['git', '-C', str(repo), *args], stderr=subprocess.DEVNULL, text=True).strip()


def init_repo(root):
    repo, remote = root / 'repo', root / 'remote.git'
    subprocess.run(['git', 'init', '--bare', '-q', str(remote)], check=True)
    subprocess.run(['git', 'init', '-q', '-b', 'main', str(repo)], check=True)
    git(repo, 'config', 'user.name', 'Queue test')
    git(repo, 'config', 'user.email', 'queue@example.invalid')
    (repo / 'base.txt').write_text('base\n')
    git(repo, 'add', '.')
    git(repo, 'commit', '-qm', 'base')
    git(repo, 'remote', 'add', 'origin', str(remote))
    git(repo, 'push', '-q', 'origin', 'main')
    return repo, remote


class SimulatedServices:
    """Uses real Git history; GitHub and model effects are explicitly simulated."""
    def __init__(self, repo, config):
        self.repo, self.config = repo, config
        self.events, self.prs = [], {}
        self.local_failures, self.ci_failures = 0, 0
        self.refuse_checks = False

    def prepare(self, task, records):
        self.events.append(('prepare', task['issue']))
        base = records[task['base_task']]['sha'] if 'base_task' in task else 'main'
        task['branch'] = 'simulated/issue-' + str(task['issue'])
        git(self.repo, 'switch', '-qc', task['branch'], base)

    def edit(self, task, feedback):
        self.events.append(('repair' if feedback else 'edit', task['issue']))
        (self.repo / ('issue-' + str(task['issue']) + '.txt')).write_text(str(task['agent_calls']))

    def validate(self, task):
        if self.local_failures:
            self.local_failures -= 1
            raise Repairable('Simulated failing local regression')

    def publish(self, task):
        git(self.repo, 'add', '.')
        git(self.repo, 'commit', '-qm', 'Issue ' + str(task['issue']))
        task['sha'] = git(self.repo, 'rev-parse', 'HEAD')
        task['pr'] = task.get('pr', len(self.prs) + 1)
        git(self.repo, 'push', '-q', 'origin', 'HEAD:refs/heads/' + task['branch'])
        self.prs[task['pr']] = pr(task['sha'])

    def verified(self, task, wait=False):
        if self.refuse_checks:
            raise Blocked('Simulated missing GitHub access/checks')
        if self.ci_failures:
            self.ci_failures -= 1
            raise Repairable('Simulated CI failure')
        if not check_gate(self.prs[task['pr']], task['sha'], self.config['required_checks']):
            raise Blocked('Simulated pending checks')
        task['pr_url'] = 'https://example.invalid/simulated/pr/' + str(task['pr'])
        task['commit_url'] = 'https://example.invalid/simulated/commit/' + task['sha']
        self.events.append(('verified', task['issue']))


class QueueTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.cfg = config()

    def tearDown(self):
        self.temp.cleanup()

    def validate_config(self, value):
        path = self.root / 'queue.json'
        atomic_json(path, value)
        return load_config(path)

    def run_simulation(self, setup=lambda service: None):
        repo, remote = init_repo(self.root)
        self.service = SimulatedServices(repo, self.cfg)
        setup(self.service)
        with Store(self.root / 'state', self.cfg) as store:
            result = Engine(self.cfg, store, self.service).run()
        return result, repo, remote

    def test_simulated_two_tasks_chain_without_another_message_and_keep_main(self):
        state, repo, remote = self.run_simulation()
        self.assertEqual([t['state'] for t in state['tasks']], ['done', 'done'])
        self.assertEqual(self.service.events, [('prepare', 11), ('edit', 11), ('verified', 11),
                                               ('prepare', 12), ('edit', 12), ('verified', 12)])
        a, b = state['tasks']
        self.assertNotEqual(a['branch'], b['branch'])
        self.assertNotEqual(a['pr'], b['pr'])
        self.assertEqual(git(repo, 'rev-parse', b['sha'] + '^'), a['sha'])
        self.assertEqual(git(remote, 'rev-parse', 'main'), git(repo, 'rev-parse', 'main'))
        self.assertEqual(git(repo, 'show', 'main:base.txt'), 'base')

    def test_failed_local_check_retains_own_draft_and_is_repaired(self):
        state, _, _ = self.run_simulation(lambda s: setattr(s, 'local_failures', 1))
        self.assertEqual(state['tasks'][0]['repairs'], 1)
        self.assertEqual(len(self.service.prs), 2)
        self.assertIn(('repair', 11), self.service.events)
        self.assertEqual(state['tasks'][1]['state'], 'done')

    def test_exhausted_local_failures_still_leave_one_reviewable_draft(self):
        state, _, _ = self.run_simulation(lambda s: setattr(s, 'local_failures', 100))
        self.assertEqual(state['tasks'][0]['state'], 'blocked')
        self.assertEqual(state['tasks'][0]['repairs'], 2)
        self.assertEqual(len(self.service.prs), 1)
        self.assertIn('pr', state['tasks'][0])

    def test_failed_ci_reuses_own_pr_and_blocks_after_two_repairs(self):
        state, _, _ = self.run_simulation(lambda s: setattr(s, 'ci_failures', 100))
        first, second = state['tasks']
        self.assertEqual(first['state'], 'blocked')
        self.assertEqual(first['repairs'], 2)
        self.assertEqual(first['agent_calls'], 3)
        self.assertEqual(second['state'], 'pending')
        self.assertEqual(len(self.service.prs), 1)
        self.assertNotIn(('prepare', 12), self.service.events)

    def test_local_and_ci_failures_share_the_same_two_repair_budget(self):
        def fail_both(service):
            service.local_failures, service.ci_failures = 1, 100
        state, _, _ = self.run_simulation(fail_both)
        self.assertEqual(state['tasks'][0]['repairs'], 2)
        self.assertEqual(state['tasks'][0]['agent_calls'], 3)
        self.assertEqual(state['tasks'][0]['state'], 'blocked')
        self.assertNotIn(('prepare', 12), self.service.events)

    def test_missing_checks_blocks_without_retrying_agent(self):
        state, _, _ = self.run_simulation(lambda s: setattr(s, 'refuse_checks', True))
        self.assertEqual(state['tasks'][0]['state'], 'blocked')
        self.assertEqual(state['tasks'][0]['agent_calls'], 1)
        self.assertNotIn(('prepare', 12), self.service.events)

    def test_global_call_budget_prevents_unbounded_next_task(self):
        self.cfg['limits']['max_agent_calls'] = 1
        state, _, _ = self.run_simulation()
        self.assertEqual([t['state'] for t in state['tasks']], ['done', 'blocked'])
        self.assertNotIn(('edit', 12), self.service.events)
        self.assertNotIn(('prepare', 12), self.service.events)

    def test_max_tasks_stops_finite_invocation(self):
        self.cfg['limits']['max_tasks'] = 1
        state, _, _ = self.run_simulation()
        self.assertEqual([t['state'] for t in state['tasks']], ['done', 'pending'])

    def test_owner_additional_call_preserves_count_and_allows_only_one(self):
        self.cfg['additional_agent_calls'] = {'11': 1}
        self.cfg['tasks'][0]['agent_calls'] = 3
        state, _, _ = self.run_simulation(lambda s: setattr(s, 'local_failures', 100))
        self.assertEqual(state['tasks'][0]['agent_calls'], 4)
        self.assertEqual(state['tasks'][0]['state'], 'blocked')
        self.assertEqual(sum(e == ('edit', 11) for e in self.service.events), 1)
        self.assertNotIn(('prepare', 12), self.service.events)

    def test_additional_call_rejects_unbounded_or_unknown_allowances(self):
        for extra in [{'11': 2}, {'11': True}, {'99': 1}]:
            candidate=config();candidate['additional_agent_calls']=extra
            with self.subTest(extra=extra), self.assertRaises(Blocked): self.validate_config(candidate)

    def test_priority_only_selects_ready_tasks(self):
        self.cfg['tasks'][1]['priority'] = -10
        state, _, _ = self.run_simulation()
        self.assertEqual(self.service.events[0], ('prepare', 11))
        self.assertEqual(state['tasks'][1]['state'], 'done')

    def test_declared_cycle_duplicate_ids_and_unknown_dependencies_rejected(self):
        for mutation in ('cycle', 'duplicate', 'unknown'):
            value = config()
            if mutation == 'cycle': value['tasks'][0]['depends_on'] = [12]
            if mutation == 'duplicate': value['tasks'][1]['issue'] = 11
            if mutation == 'unknown': value['tasks'][1]['depends_on'] = [99]
            with self.subTest(mutation=mutation), self.assertRaises(Blocked):
                self.validate_config(value)

    def test_invalid_budgets_and_empty_checks_rejected(self):
        for key, bad in [('max_repairs', 3), ('max_agent_calls', 0), ('run_seconds', True), ('max_tasks', 1000)]:
            value = config(); value['limits'][key] = bad
            with self.subTest(key=key), self.assertRaises(Blocked): self.validate_config(value)
        self.cfg['required_checks'] = []
        with self.assertRaises(Blocked): self.validate_config(self.cfg)

    def test_shipped_queue_is_disabled_and_done_seed_has_real_reference(self):
        shipped = load_config(ROOT / 'automation/queue.json')
        self.assertFalse(shipped['enabled'])
        self.assertFalse(shipped['executor_authorized'])
        self.assertEqual(shipped['tasks'][0]['pr'], 5)
        self.assertEqual(len(shipped['tasks'][0]['sha']), 40)

    def test_live_run_refuses_disabled_gates_without_submitting_any_command(self):
        path = self.root / 'queue.json'; atomic_json(path, self.cfg)
        with mock.patch.object(Commands, 'run', side_effect=AssertionError('Must not execute')):
            with self.assertRaisesRegex(Blocked, 'Execution disabled'):
                main(['run', '--repo', str(self.root), '--config', str(path), '--state-dir', str(self.root.parent / (self.root.name + '-state'))])
        # Remove the external lock-only directory created by this test.
        import shutil
        shutil.rmtree(self.root.parent / (self.root.name + '-state'))

    def test_state_cannot_be_stored_inside_checkout(self):
        atomic_json(self.root / 'queue.json', self.cfg)
        with self.assertRaisesRegex(Blocked, 'outside'):
            main(['plan', '--repo', str(self.root), '--config', 'queue.json', '--state-dir', str(self.root / 'state')])

    def test_local_lock_blocks_concurrent_controller(self):
        with Store(self.root / 'state', self.cfg):
            with self.assertRaisesRegex(Blocked, 'local lock'):
                with Store(self.root / 'state', self.cfg): pass

    def test_running_and_changed_state_require_manual_reconciliation(self):
        store = Store(self.root / 'state', self.cfg)
        state = store.read(); state['tasks'][0]['state'] = 'running'; store.save(state)
        with self.assertRaisesRegex(Blocked, 'Interrupted'): store.read()
        state['tasks'][0]['state'] = 'pending'; state['config_digest'] = 'different'; store.save(state)
        with self.assertRaisesRegex(Blocked, 'Queue changed'): store.read()

    def test_blocked_task_is_not_restarted(self):
        self.cfg['tasks'][0]['state'] = 'blocked'
        with Store(self.root / 'state', self.cfg) as store:
            with self.assertRaisesRegex(Blocked, 'manual review'):
                Engine(self.cfg, store, object()).run()

    def test_previously_done_dependency_failure_prevents_any_new_task(self):
        self.cfg['tasks'][0].update(state='done', pr=1, sha='a' * 40)
        services = mock.Mock()
        services.verified.side_effect = Repairable('Existing CI now failing')
        with Store(self.root / 'state', self.cfg) as store:
            state = Engine(self.cfg, store, services).run()
        self.assertEqual(state['tasks'][0]['state'], 'blocked')
        services.prepare.assert_not_called()
        services.edit.assert_not_called()

    def test_good_exact_sha_gate(self):
        self.assertTrue(check_gate(pr(), 'a' * 40, ['unit', 'integration']))

    def test_empty_or_skipped_checks_never_count_as_verified(self):
        value = pr(); value['statusCheckRollup'] = []
        self.assertFalse(check_gate(value, 'a' * 40, ['unit']))
        value = pr(); value['statusCheckRollup'][0]['conclusion'] = 'SKIPPED'
        self.assertFalse(check_gate(value, 'a' * 40, ['unit']))

    def test_changed_sha_closed_or_ready_pr_block(self):
        for field, value in [('headRefOid', 'b' * 40), ('state', 'CLOSED'), ('isDraft', False)]:
            candidate = pr(); candidate[field] = value
            with self.subTest(field=field), self.assertRaises(Blocked): check_gate(candidate, 'a' * 40, ['unit'])

    def test_duplicate_pending_check_does_not_hide_behind_success(self):
        value = pr()
        value['statusCheckRollup'].append({'__typename': 'CheckRun', 'name': 'unit', 'status': 'IN_PROGRESS', 'conclusion': ''})
        self.assertFalse(check_gate(value, 'a' * 40, ['unit']))

    def test_ci_failure_is_repairable_but_cancellation_is_not(self):
        value = pr(); value['statusCheckRollup'][0]['conclusion'] = 'FAILURE'
        with self.assertRaises(Repairable): check_gate(value, 'a' * 40, ['unit'])
        value['statusCheckRollup'][0]['conclusion'] = 'CANCELLED'
        with self.assertRaises(Blocked): check_gate(value, 'a' * 40, ['unit'])

    def test_apk_job_that_runs_blocks_even_when_other_checks_pass(self):
        value = pr(); value['statusCheckRollup'][-1]['conclusion'] = 'SUCCESS'
        with self.assertRaisesRegex(Blocked, 'APK'): check_gate(value, 'a' * 40, ['unit'])

    def test_unknown_check_provider_blocks(self):
        value = pr(); value['statusCheckRollup'] = [{'__typename': 'StatusContext'}]
        with self.assertRaises(Blocked): check_gate(value, 'a' * 40, ['unit'])

    def test_command_timeout_kills_child_and_stop_prevents_start(self):
        commands = Commands(self.root, self.root, 10)
        start = time.monotonic()
        with self.assertRaisesRegex(Blocked, 'time budget'):
            commands.run([sys.executable, '-c', 'import time; time.sleep(30)'], timeout=0.2)
        self.assertLess(time.monotonic() - start, 5)
        (self.root / 'STOP').touch()
        with self.assertRaisesRegex(Blocked, 'Kill switch'): commands.run(['must-not-start'])

    def test_kill_switch_interrupts_active_child(self):
        commands = Commands(self.root, self.root, 10)
        timer = threading.Timer(0.2, lambda: (self.root / 'STOP').touch())
        timer.start()
        try:
            with self.assertRaisesRegex(Blocked, 'Kill switch'):
                commands.run([sys.executable, '-c', 'import time; time.sleep(30)'])
        finally: timer.join()

    def test_raw_output_and_secrets_not_in_command_errors(self):
        commands = Commands(self.root, self.root, 10)
        with self.assertRaises(Blocked) as failure:
            commands.run([sys.executable, '-c', "print('secret-sentinel'); raise SystemExit(7)"])
        self.assertNotIn('secret-sentinel', str(failure.exception))
        self.assertIn('exit 7', str(failure.exception))

    def test_failure_diagnostics_redact_credentials_and_limit_size(self):
        with mock.patch.dict(os.environ, {'GH_TOKEN': 'sentinel-private-token'}):
            cleaned = redact('x' * 5000 + ' sentinel-private-token Bearer abcde signature=private&x=1 ghp_abc123xyz')
        self.assertLessEqual(len(cleaned), 4000)
        for secret in ['sentinel-private-token', 'abcde', 'signature=private', 'ghp_abc123xyz']:
            self.assertNotIn(secret, cleaned)

    def test_ci_log_access_failure_blocks_instead_of_blind_repair(self):
        commands = mock.Mock()
        commands.deadline = time.monotonic() + 10
        commands.run.return_value = (1, '')
        service = Services(self.cfg, commands, self.root)
        candidate = pr()
        candidate['statusCheckRollup'][0].update(conclusion='FAILURE', detailsUrl='https://github.com/owner/repo/actions/runs/123/job/456')
        service.pr = mock.Mock(return_value=candidate)
        service.source_checks = mock.Mock(return_value=candidate['statusCheckRollup'])
        service.gh = mock.Mock(return_value={'headSha': 'a' * 40, 'status': 'completed'})
        with self.assertRaisesRegex(Blocked, 'logs unavailable'):
            service.verified({'pr': 1, 'sha': 'a' * 40}, wait=True)

    def test_failure_waits_for_run_cleanup_before_fetching_diagnostic(self):
        commands = mock.Mock()
        commands.deadline = time.monotonic() + 10
        commands.run.return_value = (0, 'test failed: expected document contents')
        service = Services(self.cfg, commands, self.root)
        candidate = pr()
        candidate['statusCheckRollup'][0].update(conclusion='FAILURE', detailsUrl='https://github.com/owner/repo/actions/runs/123/job/456')
        service.pr = mock.Mock(return_value=candidate)
        service.source_checks = mock.Mock(return_value=candidate['statusCheckRollup'])
        service.gh = mock.Mock(side_effect=[{'headSha': 'a' * 40, 'status': 'in_progress'},
                                           {'headSha': 'a' * 40, 'status': 'completed'}])
        with mock.patch('task_queue.time.sleep'), self.assertRaisesRegex(Repairable, 'expected document contents'):
            service.verified({'pr': 1, 'sha': 'a' * 40}, wait=True)
        self.assertEqual(service.gh.call_count, 2)
        self.assertEqual(commands.run.call_count, 1)

    def test_exact_head_check_runs_are_paginated_and_not_dependent_on_pr_rollup(self):
        commands = mock.Mock()
        commands.deadline = time.monotonic() + 10
        service = Services(self.cfg, commands, self.root)
        candidate = pr()
        candidate.update(statusCheckRollup=[], url='https://example.invalid/pr/1', headRefName='codex-queue/issue-11')
        service.pr = mock.Mock(return_value=candidate)
        raw = lambda name: {'name': name, 'head_sha': 'a' * 40, 'status': 'completed', 'conclusion': 'success'}
        commands.run.return_value = (0, json.dumps({'check_runs': [raw('unit')]}) + '\n' +
                                     json.dumps({'check_runs': [raw('integration')]}))
        task = {'pr': 1, 'sha': 'a' * 40}
        service.verified(task)
        self.assertEqual(task['ci'], 'passed')
        self.assertIn('--paginate', commands.run.call_args.args[0])
        self.assertNotIn('--slurp', commands.run.call_args.args[0])
        wrong = raw('unit'); wrong['head_sha'] = 'b' * 40
        commands.run.return_value = (0, json.dumps({'check_runs': [wrong]}))
        with self.assertRaisesRegex(Blocked, 'another SHA'): service.source_checks('a' * 40)

    def test_remote_lock_is_atomic_across_separate_state_directories(self):
        repo, remote = init_repo(self.root)
        first = Services(self.cfg, Commands(repo, self.root / 's1', 30), self.root)
        second = Services(self.cfg, Commands(repo, self.root / 's2', 30), self.root)
        first.acquire()
        try:
            with self.assertRaisesRegex(Blocked, 'Remote controller lock'): second.acquire()
            self.assertEqual(git(remote, 'rev-parse', Services.LOCK_REF), first.lock_sha)
        finally: first.release()
        self.assertEqual(git(repo, 'ls-remote', '--heads', 'origin', Services.LOCK_REF), '')

    def test_stale_owner_cannot_release_a_different_remote_lock(self):
        repo, remote = init_repo(self.root)
        service = Services(self.cfg, Commands(repo, self.root / 'state', 30), self.root)
        service.acquire()
        tree = git(repo, 'rev-parse', 'main^{tree}')
        replacement = git(repo, 'commit-tree', tree, '-p', service.lock_sha, '-m', 'different owner')
        git(repo, 'push', '-q', 'origin', replacement + ':' + Services.LOCK_REF)
        with self.assertRaises(Blocked): service.release()
        self.assertEqual(git(remote, 'rev-parse', Services.LOCK_REF), replacement)

    def test_protected_native_changes_block_before_any_validation_program(self):
        repo, _ = init_repo(self.root)
        (repo / 'native3d').mkdir(); (repo / 'native3d/new.rs').write_text('// must be rejected')
        service = Services(self.cfg, Commands(repo, self.root / 'state', 10), self.root)
        service.head = git(repo, 'rev-parse', 'HEAD')
        with self.assertRaisesRegex(Blocked, 'Protected path'): service.validate({'issue': 11})

    def test_local_failure_supplies_redacted_diagnostics_to_repair(self):
        commands = mock.Mock()
        commands.run.return_value = (1, 'Compiler error: secret-sentinel')
        service = Services(self.cfg, commands, self.root)
        service.head = 'a' * 40
        service.git = mock.Mock(return_value='app/source.java\0')
        with mock.patch.dict(os.environ, {'GH_TOKEN': 'secret-sentinel'}):
            with self.assertRaises(Repairable) as failure: service.validate({'issue': 11})
        self.assertIn('Compiler error', str(failure.exception))
        self.assertNotIn('secret-sentinel', str(failure.exception))
        self.assertTrue(commands.run.call_args.kwargs['diagnostics'])

    def test_real_codex_adapter_is_opt_in_sandboxed_and_strips_tokens(self):
        (self.root / 'instructions.txt').write_text('Trusted instructions')
        commands = mock.Mock()
        commands.run.return_value = (0, json.dumps({'state': 'open', 'title': 'Task', 'body': 'Change only the app'}))
        service = Services(self.cfg, commands, self.root)
        service.branch, service.head = 'codex-queue/issue-11', 'a' * 40
        service.git = mock.Mock(side_effect=[service.branch, service.head])
        with mock.patch.dict(os.environ, {'GH_TOKEN': 'secret-sentinel', 'OPENAI_API_KEY': 'must-not-use'}):
            service.edit({'issue': 11}, None)
        args, kwargs = commands.run.call_args
        command = args[0]
        self.assertEqual(command[:2], ['codex', 'exec'])
        self.assertIn('--ignore-user-config', command)
        self.assertIn('workspace-write', command)
        self.assertIn('sandbox_workspace_write.network_access=false', command)
        self.assertNotIn('GH_TOKEN', kwargs['env'])
        self.assertNotIn('OPENAI_API_KEY', kwargs['env'])
        self.assertNotIn('--dangerously-bypass-approvals-and-sandbox', command)

    def test_agent_report_retains_failed_tool_diagnostic_without_credentials(self):
        (self.root / 'instructions.txt').write_text('Trusted instructions')
        commands = mock.Mock()
        commands.run.return_value = (0, '\n'.join(json.dumps(event) for event in [
            {'type': 'item.completed', 'item': {'type': 'command_execution', 'exit_code': 1,
             'aggregated_output': 'app-server socket directory must have mode 0700'}},
            {'type': 'item.completed', 'item': {'type': 'agent_message',
             'text': 'Unable to edit: secret-sentinel eyJabc.abc.signature "access_token":"private"'}},
        ]))
        service = Services(self.cfg, commands, self.root)
        service.gh = mock.Mock(return_value={'state': 'open', 'title': 'Task', 'body': 'Task'})
        service.branch, service.head = 'codex-queue/issue-11', 'a' * 40
        service.git = mock.Mock(side_effect=[service.branch, service.head])
        task = {'issue': 11}
        with mock.patch.dict(os.environ, {'GH_TOKEN': 'secret-sentinel'}): service.edit(task, None)
        self.assertIn('Unable to edit', task['agent_report'])
        for secret in ['secret-sentinel', 'eyJabc.abc.signature', '"private"']:
            self.assertNotIn(secret, task['agent_report'])
        self.assertIn('mode 0700', task['agent_command_failures'][0])

    def test_zero_changes_blocks_before_running_stock_tests(self):
        commands = mock.Mock()
        service = Services(self.cfg, commands, self.root)
        service.git = mock.Mock(return_value='')
        with self.assertRaisesRegex(Blocked, 'no changes'): service.validate({'issue': 11})
        commands.run.assert_not_called()

    def test_cli_failed_turn_retains_redacted_error(self):
        (self.root / 'instructions.txt').write_text('Trusted instructions')
        commands = mock.Mock()
        commands.run.return_value = (1, json.dumps({'type': 'turn.failed', 'error': {'message': 'Authentication failed'}}))
        service = Services(self.cfg, commands, self.root)
        service.gh = mock.Mock(return_value={'state': 'open', 'title': 'Task', 'body': 'Task'})
        task = {'issue': 11}
        with self.assertRaisesRegex(Blocked, 'diagnostics retained'): service.edit(task, None)
        self.assertIn('Authentication failed', task['agent_error'])

    def test_stacked_pr_dispatch_uses_own_branch_and_explicitly_disables_apk(self):
        commands = mock.Mock()
        commands.run.return_value = (0, '')
        service = Services(self.cfg, commands, self.root)
        service.base, service.branch, service.head = 'codex-queue/issue-11', 'codex-queue/issue-12', 'a' * 40
        def git_result(*args):
            if args[0] == 'status': return ' M app/source.java'
            if args[0] == 'rev-parse': return 'b' * 40
            return ''
        service.git = mock.Mock(side_effect=git_result)
        service.gh = mock.Mock(return_value={'number': 2, 'html_url': 'https://example.invalid/pr/2'})
        task = {'issue': 12, 'branch': service.branch}
        service.publish(task)
        request = json.loads((self.root / 'pr.json').read_text())
        self.assertTrue(request['draft'])
        self.assertEqual(request['base'], service.base)
        self.assertEqual(request['head'], service.branch)
        command = commands.run.call_args.args[0]
        self.assertIn('inputs[build_apk]=false', command)
        self.assertIn('ref=' + service.branch, command)
        self.assertTrue(any(call.args[0] == 'push' and call.args[-1].endswith(':refs/heads/' + service.branch)
                            for call in service.git.call_args_list))


if __name__ == '__main__':
    unittest.main()
