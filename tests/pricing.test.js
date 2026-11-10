import test from 'node:test';
import assert from 'node:assert/strict';
import { availableBalanceMicro, formatUsd, isPostpaidBalance, priceUnitLabel, startingPrice } from '../src/lib/pricing.ts';

test('formatUsd keeps cents and never rounds small prices to zero', () => {
  assert.equal(formatUsd(200000), '$0.20');
  assert.equal(formatUsd(98000), '$0.098');
  assert.equal(formatUsd(19125), '$0.0191');
  assert.equal(formatUsd(2100), '$0.0021');
  assert.equal(formatUsd(1000), '$0.001');
  assert.equal(formatUsd(1), '$0.000001');
  assert.equal(formatUsd(5880000), '$5.88');
  assert.equal(formatUsd(120000000), '$120');
  assert.equal(formatUsd(0), '$0');
  assert.equal(formatUsd(Number.NaN), '');
});

test('priceUnitLabel describes common catalog billing units in Croatian', () => {
  assert.equal(priceUnitLabel({ type: 'second', quantity: 1 }), 's');
  assert.equal(priceUnitLabel({ type: 'minute', quantity: 1 }), 'min');
  assert.equal(priceUnitLabel({ type: 'character', quantity: 1000 }), '1000 znakova');
  assert.equal(priceUnitLabel({ type: 'video_output_token', quantity: 1000000 }), '1M tokena');
  assert.equal(priceUnitLabel({ type: 'brand_new_unit', quantity: 1 }), 'brand new unit');
  assert.equal(priceUnitLabel({}), null);
});

test('startingPrice prefers the output component and flags extra billed parts', () => {
  const single = { components: [{ role: 'output', unit: { type: 'second', quantity: 1 }, starting_at: { micro_usd: 98000 } }] };
  assert.deepEqual(startingPrice(single), { amount: '$0.098', unit: 's', label: 'od $0.098 / s', microUsd: 98000, partial: false });
  const multi = {
    components: [
      { role: 'input', unit: { type: 'input_image', quantity: 1 }, starting_at: { micro_usd: 40000 } },
      { role: 'output', unit: { type: 'output_second', quantity: 1 }, starting_at: { micro_usd: 80000 } },
    ],
  };
  assert.equal(startingPrice(multi).label, 'od $0.08 / s');
  assert.equal(startingPrice(multi).partial, true);
});

test('startingPrice rejects missing or malformed pricing', () => {
  assert.equal(startingPrice(undefined), null);
  assert.equal(startingPrice({ components: [] }), null);
  assert.equal(startingPrice({ components: [{ role: 'output', unit: { type: 'second' }, starting_at: { micro_usd: -1 } }] }), null);
  assert.equal(startingPrice({ components: [{ role: 'output', unit: { type: 'second' }, starting_at: { micro_usd: '5' } }] }), null);
});

test('availableBalanceMicro matches prepaid and postpaid server checks', () => {
  assert.equal(availableBalanceMicro({ balance_micro_usd: 1500000, postpaid: null }), 1500000);
  const postpaid = { balance_micro_usd: 0, postpaid: { active: true, cycle: { remaining_micro_usd: 9000000 } } };
  assert.equal(availableBalanceMicro(postpaid), 9000000);
  assert.equal(isPostpaidBalance(postpaid), true);
  assert.equal(isPostpaidBalance({ balance_micro_usd: 1 }), false);
  assert.equal(availableBalanceMicro({ postpaid: { active: true, cycle: {} } }), null);
  assert.equal(availableBalanceMicro(null), null);
});
