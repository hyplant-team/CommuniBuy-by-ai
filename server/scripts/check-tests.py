"""Require both layers, critical suite discovery and zero failures/errors/skips."""
from pathlib import Path
import argparse
import xml.etree.ElementTree as ET

parser = argparse.ArgumentParser()
parser.add_argument('--task', choices=('test', 'integrationTest'), help='Inspect one layer only; default checks full acceptance')
args = parser.parse_args()
required = {
    'test': {'BusinessRulesTest', 'TestDatabasePolicyTest', 'SafeDiagnosticsTest', 'RevocationCleanupTest'},
    'integrationTest': {'AuthPolicyTest', 'BackendIntegrationTest', 'CommerceIntegrationTest', 'FinanceIntegrationTest', 'RefundDiscoveryIntegrationTest', 'MigrationTest', 'ReliabilityIntegrationTest', 'ReviewLockIntegrationTest', 'RevocationCleanupIntegrationTest'},
}
minimum = {'test': 16, 'integrationTest': 89}
totals = {k: 0 for k in ('tests', 'failures', 'errors', 'skipped')}
seen = set()
base = Path(__file__).resolve().parents[1] / 'app/build/test-results'
for task in ([args.task] if args.task else required):
    roots = [ET.parse(p).getroot() for p in (base / task).glob('TEST-*.xml')]
    actual = {r.attrib['name'].rsplit('.', 1)[-1] for r in roots}
    assert required[task] <= actual, f'{task}: missing critical suites {required[task] - actual}'
    other = 'integrationTest' if task == 'test' else 'test'
    assert not (actual & required[other]), f'{task}: suites assigned to wrong layer'
    counts = {k: sum(int(r.attrib.get(k, 0)) for r in roots) for k in totals}
    print(task, counts)
    assert counts['tests'] >= minimum[task], f'{task}: insufficient discovered tests'
    assert counts['failures'] == counts['errors'] == counts['skipped'] == 0, f'{task}: failed or skipped tests'
    for root in roots:
        for case in root.findall('testcase'):
            identity = (case.attrib.get('classname'), case.attrib['name'])
            assert identity not in seen, f'Duplicate test across layers: {identity}'
            seen.add(identity)
    for key in totals:
        totals[key] += counts[key]
print('FULL ACCEPTANCE' if not args.task else 'ONE LAYER ONLY', totals)
