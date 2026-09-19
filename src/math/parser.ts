/**
 * Shunting-Yard Math Parser & Evaluator for Scientific Calculator
 * Supports operators (+, -, *, /, ^, %), functions (sin, cos, tan, asin, acos, atan, log, ln, sqrt, n!),
 * constants (pi, e), parentheses, and DEG/RAD angle modes.
 */

export type AngleMode = 'DEG' | 'RAD';

export interface ParseResult {
  value: number;
  error?: string;
}

export class MathEvaluator {
  private angleMode: AngleMode = 'DEG';
  private memoryValue: number = 0;

  constructor(angleMode: AngleMode = 'DEG') {
    this.angleMode = angleMode;
  }

  public setAngleMode(mode: AngleMode) {
    this.angleMode = mode;
  }

  public getAngleMode(): AngleMode {
    return this.angleMode;
  }

  public getMemory(): number {
    return this.memoryValue;
  }

  public memoryAdd(val: number) {
    this.memoryValue += val;
  }

  public memorySubtract(val: number) {
    this.memoryValue -= val;
  }

  public memoryClear() {
    this.memoryValue = 0;
  }

  /**
   * Evaluates a mathematical expression string.
   */
  public evaluate(expr: string): number {
    if (!expr || expr.trim() === '') return 0;
    
    // Normalize string representation (unicode operators -> standard ascii)
    const normalized = this.normalizeExpression(expr);
    const tokens = this.tokenize(normalized);
    const rpn = this.shuntingYard(tokens);
    return this.evaluateRPN(rpn);
  }

  private normalizeExpression(expr: string): string {
    return expr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/π/g, 'pi')
      .replace(/e/g, 'e')
      .replace(/√\(/g, 'sqrt(')
      .replace(/√/g, 'sqrt');
  }

  private tokenize(expr: string): string[] {
    const tokens: string[] = [];
    let i = 0;

    while (i < expr.length) {
      const char = expr[i];

      // Skip whitespaces
      if (/\s/.test(char)) {
        i++;
        continue;
      }

      // Check numbers (including decimals and scientific notation like 1e5)
      if (/[0-9\.]/.test(char)) {
        let numStr = '';
        while (i < expr.length && /[0-9\.]/.test(expr[i])) {
          numStr += expr[i];
          i++;
        }
        tokens.push(numStr);
        continue;
      }

      // Check word identifiers (functions or constants)
      if (/[a-zA-Z]/.test(char)) {
        let word = '';
        while (i < expr.length && /[a-zA-Z0-9]/.test(expr[i])) {
          word += expr[i];
          i++;
        }
        tokens.push(word.toLowerCase());
        continue;
      }

      // Check operators and parentheses
      if ('+-*/%^()!'.includes(char)) {
        // Handle unary minus (negative numbers)
        if (char === '-') {
          const prevToken = tokens[tokens.length - 1];
          if (tokens.length === 0 || prevToken === '(' || '+-*/%^'.includes(prevToken)) {
            tokens.push('u-'); // Unary minus identifier
            i++;
            continue;
          }
        }
        tokens.push(char);
        i++;
        continue;
      }

      i++;
    }

    return tokens;
  }

  private shuntingYard(tokens: string[]): string[] {
    const outputQueue: string[] = [];
    const operatorStack: string[] = [];

    const precedence: Record<string, number> = {
      '+': 2,
      '-': 2,
      '*': 3,
      '/': 3,
      '%': 3,
      '^': 4,
      'u-': 5,
      '!': 6
    };

    const rightAssociative: Record<string, boolean> = {
      '^': true,
      'u-': true
    };

    const isFunction = (t: string) =>
      ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'log', 'ln', 'sqrt', 'abs', 'exp'].includes(t);

    for (const token of tokens) {
      if (!isNaN(Number(token)) || token === 'pi' || token === 'e') {
        outputQueue.push(token);
      } else if (isFunction(token)) {
        operatorStack.push(token);
      } else if (token === '!') {
        // Postfix operator factorial
        outputQueue.push('!');
      } else if (token in precedence) {
        while (
          operatorStack.length > 0 &&
          operatorStack[operatorStack.length - 1] !== '(' &&
          ((!rightAssociative[token] &&
            precedence[operatorStack[operatorStack.length - 1]] >= precedence[token]) ||
            (rightAssociative[token] &&
              precedence[operatorStack[operatorStack.length - 1]] > precedence[token]))
        ) {
          outputQueue.push(operatorStack.pop()!);
        }
        operatorStack.push(token);
      } else if (token === '(') {
        operatorStack.push(token);
      } else if (token === ')') {
        while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== '(') {
          outputQueue.push(operatorStack.pop()!);
        }
        if (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] === '(') {
          operatorStack.pop(); // Pop '('
        }
        if (operatorStack.length > 0 && isFunction(operatorStack[operatorStack.length - 1])) {
          outputQueue.push(operatorStack.pop()!);
        }
      }
    }

    while (operatorStack.length > 0) {
      const op = operatorStack.pop()!;
      if (op === '(' || op === ')') {
        throw new Error('Mismatched parentheses');
      }
      outputQueue.push(op);
    }

    return outputQueue;
  }

  private evaluateRPN(rpn: string[]): number {
    const stack: number[] = [];

    for (const token of rpn) {
      if (!isNaN(Number(token))) {
        stack.push(Number(token));
      } else if (token === 'pi') {
        stack.push(Math.PI);
      } else if (token === 'e') {
        stack.push(Math.E);
      } else if (token === 'u-') {
        const val = stack.pop();
        if (val === undefined) throw new Error('Invalid unary minus');
        stack.push(-val);
      } else if (token === '!') {
        const val = stack.pop();
        if (val === undefined) throw new Error('Invalid factorial');
        stack.push(this.factorial(val));
      } else if (['+', '-', '*', '/', '%', '^'].includes(token)) {
        const b = stack.pop();
        const a = stack.pop();
        if (a === undefined || b === undefined) throw new Error(`Invalid operands for ${token}`);

        switch (token) {
          case '+': stack.push(a + b); break;
          case '-': stack.push(a - b); break;
          case '*': stack.push(a * b); break;
          case '/':
            if (b === 0) throw new Error('Division by zero');
            stack.push(a / b);
            break;
          case '%': stack.push(a % b); break;
          case '^': stack.push(Math.pow(a, b)); break;
        }
      } else {
        // Single operand functions
        const val = stack.pop();
        if (val === undefined) throw new Error(`Invalid operand for function ${token}`);

        switch (token) {
          case 'sin':
            stack.push(Math.sin(this.toRadians(val)));
            break;
          case 'cos':
            stack.push(Math.cos(this.toRadians(val)));
            break;
          case 'tan':
            stack.push(Math.tan(this.toRadians(val)));
            break;
          case 'asin':
            stack.push(this.fromRadians(Math.asin(val)));
            break;
          case 'acos':
            stack.push(this.fromRadians(Math.acos(val)));
            break;
          case 'atan':
            stack.push(this.fromRadians(Math.atan(val)));
            break;
          case 'log':
            if (val <= 0) throw new Error('Logarithm out of domain');
            stack.push(Math.log10(val));
            break;
          case 'ln':
            if (val <= 0) throw new Error('Natural log out of domain');
            stack.push(Math.log(val));
            break;
          case 'sqrt':
            if (val < 0) throw new Error('Square root of negative number');
            stack.push(Math.sqrt(val));
            break;
          case 'abs':
            stack.push(Math.abs(val));
            break;
          case 'exp':
            stack.push(Math.exp(val));
            break;
        }
      }
    }

    if (stack.length !== 1) {
      throw new Error('Invalid math expression syntax');
    }

    return stack[0];
  }

  private toRadians(val: number): number {
    return this.angleMode === 'DEG' ? (val * Math.PI) / 180 : val;
  }

  private fromRadians(val: number): number {
    return this.angleMode === 'DEG' ? (val * 180) / Math.PI : val;
  }

  private factorial(n: number): number {
    if (n < 0 || !Number.isInteger(n)) {
      throw new Error('Factorial requires non-negative integer');
    }
    if (n === 0 || n === 1) return 1;
    let res = 1;
    for (let i = 2; i <= n; i++) {
      res *= i;
    }
    return res;
  }
}
