import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MathEvaluator } from './parser.ts';

describe('MathEvaluator', () => {
  it('evaluates basic arithmetic operations correctly', () => {
    const evaluator = new MathEvaluator('DEG');
    assert.strictEqual(evaluator.evaluate('2 + 3 × 4'), 14);
    assert.strictEqual(evaluator.evaluate('(2 + 3) × 4'), 20);
    assert.strictEqual(evaluator.evaluate('10 − 4 ÷ 2'), 8);
    assert.strictEqual(evaluator.evaluate('10 % 3'), 1);
  });

  it('handles negative numbers correctly', () => {
    const evaluator = new MathEvaluator('DEG');
    assert.strictEqual(evaluator.evaluate('-5 + 3'), -2);
    assert.strictEqual(evaluator.evaluate('10 * -2'), -20);
  });

  it('evaluates scientific functions in DEG mode', () => {
    const evaluator = new MathEvaluator('DEG');
    assert.ok(Math.abs(evaluator.evaluate('sin(90)') - 1) < 1e-5);
    assert.ok(Math.abs(evaluator.evaluate('cos(0)') - 1) < 1e-5);
    assert.ok(Math.abs(evaluator.evaluate('tan(45)') - 1) < 1e-5);
  });

  it('evaluates scientific functions in RAD mode', () => {
    const evaluator = new MathEvaluator('RAD');
    assert.ok(Math.abs(evaluator.evaluate('sin(pi / 2)') - 1) < 1e-5);
    assert.ok(Math.abs(evaluator.evaluate('cos(pi)') - (-1)) < 1e-5);
  });

  it('evaluates logarithmic and power functions', () => {
    const evaluator = new MathEvaluator('DEG');
    assert.strictEqual(evaluator.evaluate('log(100)'), 2);
    assert.ok(Math.abs(evaluator.evaluate('ln(e)') - 1) < 1e-5);
    assert.strictEqual(evaluator.evaluate('2 ^ 3'), 8);
    assert.strictEqual(evaluator.evaluate('sqrt(16)'), 4);
  });

  it('evaluates factorials', () => {
    const evaluator = new MathEvaluator('DEG');
    assert.strictEqual(evaluator.evaluate('5!'), 120);
    assert.strictEqual(evaluator.evaluate('0!'), 1);
  });

  it('handles memory operations', () => {
    const evaluator = new MathEvaluator('DEG');
    evaluator.memoryAdd(10);
    evaluator.memoryAdd(5);
    assert.strictEqual(evaluator.getMemory(), 15);
    evaluator.memorySubtract(3);
    assert.strictEqual(evaluator.getMemory(), 12);
    evaluator.memoryClear();
    assert.strictEqual(evaluator.getMemory(), 0);
  });

  it('throws error on division by zero', () => {
    const evaluator = new MathEvaluator('DEG');
    assert.throws(() => evaluator.evaluate('5 / 0'), /Division by zero/);
  });
});
