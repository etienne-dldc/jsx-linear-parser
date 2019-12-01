import { InputStream } from './InputStream';
import { Tag, NodeType, Nodes, Node, Props, Prop } from './Node';
import { Parser as LiteralParser } from 'literal-parser';

export const Parser = {
  parse,
};

function parse(file: string): any {
  const input = InputStream(file);

  return root();

  function root() {
    skipWhitespaces();
    const tag = parseMaybeTab();
    if (tag === false) {
      return input.croak('Expected a Tag');
    }
    return tag;
  }

  function parseMaybeTab(): false | Tag {
    const state = input.saveState();
    try {
      skip('<');
      const isClosing = maybeSkip('/');
      const name = parseComponentName();
      const props = parseProps();
      skipWhitespaces();
      const isSelfClose = isClosing === false && maybeSkip('/');
      skip('>');
      if (isSelfClose) {
        return createNode('SelfClosingTag', { component: name, props });
      }
      if (isClosing) {
        return createNode('ClosingTag', { component: name, props });
      }
      return createNode('OpeningTag', { component: name, props });
    } catch (error) {
      console.error(error);
      input.restoreState(state);
      return false;
    }
  }

  function parseProps(): Props {
    skipWhitespaces();
    const props: Props = [];
    while (!input.eof() && isPropNameStart(input.peek())) {
      props.push(parseProp());
      skipWhitespaces();
    }
    return props;
  }

  function parseProp(): Prop {
    skipWhitespaces();
    const name = readWhile(isPropNameChar);
    skip('=');
    const value = parsePropValue();
    skipWhitespaces();
    return createNode('Prop', { name, value });
  }

  function parsePropValue(): any {
    const ch = input.next();
    if (ch === '"') {
      const val = parseString();
      return val;
    }
    if (ch === '{') {
      const content = file.slice(input.saveState().pos);
      const res = LiteralParser.parseOne(content);
      for (let i = 0; i < res.length; i++) {
        input.next();
      }
      skip('}');
      return res.value;
    }
  }

  function parseString(): string {
    let escaped = false;
    let str = '';
    while (!input.eof()) {
      const ch = input.next();
      if (escaped) {
        str += ch;
        escaped = false;
      } else if (ch === '"') {
        break;
      } else if (ch === '\\') {
        escaped = true;
      } else {
        str += ch;
      }
    }
    return str;
  }

  function parseComponentName(): string {
    if (isNameStart(input.peek())) {
      return readWhile(isNameChar);
    }
    return input.croak(`Unexpected "${input.peek()}"`);
  }

  function isNameStart(ch: string): boolean {
    return /[A-Z]/i.test(ch);
  }

  function isPropNameStart(ch: string): boolean {
    return /[a-z]/i.test(ch);
  }

  function isPropNameChar(ch: string): boolean {
    return isPropNameStart(ch) || /[A-Za-z0-9_]/i.test(ch);
  }

  function isNameChar(ch: string): boolean {
    return isNameStart(ch) || /[A-Za-z0-9._]/i.test(ch);
  }

  function readWhile(predicate: (ch: string) => boolean): string {
    let str = '';
    while (!input.eof() && predicate(input.peek())) {
      str += input.next();
    }
    return str;
  }

  function skipWhitespaces(): boolean {
    if (!isWhitspace(input.peek())) {
      return false;
    }
    while (!input.eof() && isWhitspace(input.peek())) {
      input.next();
    }
    return true;
  }

  function isWhitspace(char: string): boolean {
    return char === ' ' || char === '\t' || char === '\n';
  }

  function skip(char: string) {
    if (input.peek() !== char) {
      input.croak(`Expected ${char} got ${input.peek()}`);
    }
    input.next();
  }

  function maybeSkip(char: string): boolean {
    if (input.peek() === char) {
      input.next();
      return true;
    }
    return false;
  }

  function createNode<K extends NodeType>(type: K, data: Nodes[K]): Node<K> {
    return {
      type,
      ...data,
      cursor: input.cursor(),
    } as any;
  }
}
