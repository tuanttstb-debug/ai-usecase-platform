/**
 * test-id-generation.js
 * Unit tests cho logic sinh UseCase_ID (tái hiện thuật toán GAS trong JS thuần).
 * Chạy: node assets/tests/test-id-generation.js
 */

// ── Constants (copy từ Config.gs) ─────────────────────────────────
var ID_PREFIX  = 'AIUS-';
var ID_PADDING = 4;
var CONFIG_DEFAULTS = { NEXT_ID: 1 };

// ── Mock helpers (thay thế GAS Spreadsheet API) ───────────────────
function _mockGetAllUseCaseIds_(existingIds) {
  return existingIds.filter(function(id) {
    return id && id.indexOf(ID_PREFIX) === 0;
  });
}

function _mockGetMaxExistingIdNum_(existingIds) {
  var ids = _mockGetAllUseCaseIds_(existingIds);
  var max = 0;
  ids.forEach(function(id) {
    var num = parseInt(id.slice(ID_PREFIX.length), 10);
    if (!isNaN(num) && num > max) max = num;
  });
  return max;
}

/**
 * Core algorithm: deterministic, dễ test
 * @param {number} nextFromConfig  - NEXT_ID từ CONFIG sheet
 * @param {string[]} existingIds   - Tất cả UseCase_ID trong MASTER_DATA
 * @returns {{ id: string, nextCounter: number }}
 */
function generateIdAlgorithm(nextFromConfig, existingIds) {
  var maxExisting = _mockGetMaxExistingIdNum_(existingIds);
  var candidate   = Math.max(nextFromConfig, maxExisting + 1);

  var idStr;
  do {
    idStr     = ID_PREFIX + ('0000' + candidate).slice(-ID_PADDING);
    candidate = candidate + 1;
  } while (existingIds.indexOf(idStr) !== -1);

  return { id: idStr, nextCounter: candidate };
}

// ── Test runner ───────────────────────────────────────────────────
var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('  ✓ ' + name);
    passed++;
  } catch (e) {
    console.log('  ✗ ' + name);
    console.log('    ' + e.message);
    failed++;
  }
}

function expect(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(
      (label ? label + ': ' : '') +
      'Expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual)
    );
  }
}

// ── Test Suites ───────────────────────────────────────────────────

console.log('\n=== ID Generation Algorithm Tests ===\n');

// Suite 1: Counter đồng bộ với data
console.log('Suite 1: Counter đồng bộ với MASTER_DATA');
test('Normal case — counter = 5, max existing = 4 → AIUS-0005', function() {
  var r = generateIdAlgorithm(5, ['AIUS-0001','AIUS-0002','AIUS-0003','AIUS-0004']);
  expect(r.id, 'AIUS-0005', 'id');
  expect(r.nextCounter, 6, 'nextCounter');
});

test('Empty sheet — counter = 1, no existing → AIUS-0001', function() {
  var r = generateIdAlgorithm(1, []);
  expect(r.id, 'AIUS-0001', 'id');
  expect(r.nextCounter, 2, 'nextCounter');
});

test('Counter = 1 with existing AIUS-0001 → skip to AIUS-0002', function() {
  var r = generateIdAlgorithm(1, ['AIUS-0001']);
  expect(r.id, 'AIUS-0002', 'id');
  expect(r.nextCounter, 3, 'nextCounter');
});

// Suite 2: Counter BEHIND actual data (import/migration case)
console.log('\nSuite 2: Counter lệch hậu — MASTER_DATA có ID cao hơn CONFIG');
test('Counter = 3, max existing = 5 → AIUS-0006', function() {
  var r = generateIdAlgorithm(3, ['AIUS-0001','AIUS-0002','AIUS-0005']);
  expect(r.id, 'AIUS-0006', 'id');
  expect(r.nextCounter, 7, 'nextCounter');
});

test('Counter = 1, MASTER_DATA has AIUS-0001 to AIUS-0010 → AIUS-0011', function() {
  var ids = [];
  for (var i = 1; i <= 10; i++) {
    ids.push('AIUS-' + ('0000' + i).slice(-4));
  }
  var r = generateIdAlgorithm(1, ids);
  expect(r.id, 'AIUS-0011', 'id');
  expect(r.nextCounter, 12, 'nextCounter');
});

test('Counter = 0 (corrupted), MASTER_DATA max = 7 → AIUS-0008', function() {
  var r = generateIdAlgorithm(0, ['AIUS-0001','AIUS-0007']);
  expect(r.id, 'AIUS-0008', 'id');
});

// Suite 3: Counter AHEAD of data (expected case after gaps)
console.log('\nSuite 3: Counter tiến hơn data — giữ nguyên gap');
test('Counter = 10, max existing = 5 → AIUS-0010 (respects higher counter)', function() {
  var r = generateIdAlgorithm(10, ['AIUS-0001','AIUS-0002','AIUS-0003','AIUS-0004','AIUS-0005']);
  expect(r.id, 'AIUS-0010', 'id');
  expect(r.nextCounter, 11, 'nextCounter');
});

// Suite 4: Collision loop — multiple IDs already exist at candidate
console.log('\nSuite 4: Collision loop — skip nhiều ID đã tồn tại');
test('Counter = 3, AIUS-0003 and AIUS-0004 taken manually → AIUS-0005', function() {
  var r = generateIdAlgorithm(3, ['AIUS-0001','AIUS-0002','AIUS-0003','AIUS-0004']);
  expect(r.id, 'AIUS-0005', 'id');
  expect(r.nextCounter, 6, 'nextCounter');
});

test('Max = 8, counter = 9, AIUS-0009 and AIUS-0010 taken → AIUS-0011', function() {
  var r = generateIdAlgorithm(9, ['AIUS-0008','AIUS-0009','AIUS-0010']);
  expect(r.id, 'AIUS-0011', 'id');
  expect(r.nextCounter, 12, 'nextCounter');
});

// Suite 5: Formatting
console.log('\nSuite 5: Zero-padding format');
test('ID 1 → AIUS-0001 (4 digits)', function() {
  var r = generateIdAlgorithm(1, []);
  expect(r.id, 'AIUS-0001');
});

test('ID 99 → AIUS-0099 (4 digits)', function() {
  var r = generateIdAlgorithm(99, []);
  expect(r.id, 'AIUS-0099');
});

test('ID 1000 → AIUS-1000 (no truncation)', function() {
  var r = generateIdAlgorithm(1000, []);
  expect(r.id, 'AIUS-1000');
});

// Suite 6: peekNextUseCaseId simulation
console.log('\nSuite 6: Peek (read-only preview)');
function peekAlgorithm(nextFromConfig, existingIds) {
  var maxExisting = _mockGetMaxExistingIdNum_(existingIds);
  var candidate   = Math.max(nextFromConfig, maxExisting + 1);
  var idStr;
  do {
    idStr     = ID_PREFIX + ('0000' + candidate).slice(-ID_PADDING);
    candidate = candidate + 1;
  } while (existingIds.indexOf(idStr) !== -1);
  return idStr;
}

test('Peek returns same ID as generate (counter in sync)', function() {
  var existing = ['AIUS-0001','AIUS-0002','AIUS-0003'];
  var peeked   = peekAlgorithm(4, existing);
  var generated = generateIdAlgorithm(4, existing).id;
  expect(peeked, generated, 'peek matches generate');
});

test('Peek does not mutate existing IDs array', function() {
  var existing = ['AIUS-0001'];
  var before   = existing.length;
  peekAlgorithm(2, existing);
  expect(existing.length, before, 'array unchanged');
});

// ── Summary ───────────────────────────────────────────────────────
console.log('\n─────────────────────────────────');
var total = passed + failed;
console.log('Results: ' + passed + '/' + total + ' passed' + (failed > 0 ? ' (' + failed + ' FAILED)' : ''));
if (failed > 0) {
  process.exitCode = 1;
}
