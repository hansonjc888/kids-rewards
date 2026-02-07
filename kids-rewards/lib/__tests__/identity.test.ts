import { parseIdentity } from '../identity';

describe('parseIdentity', () => {
  it('should parse @name from beginning of message', () => {
    const result = parseIdentity('@Alice Read 20 pages');

    expect(result.username).toBe('Alice');
    expect(result.cleanText).toBe('Read 20 pages');
  });

  it('should handle lowercase @name', () => {
    const result = parseIdentity('@alice Read 20 pages');

    expect(result.username).toBe('alice');
    expect(result.cleanText).toBe('Read 20 pages');
  });

  it('should return null username when no @name present', () => {
    const result = parseIdentity('Read 20 pages');

    expect(result.username).toBeNull();
    expect(result.cleanText).toBe('Read 20 pages');
  });

  it('should handle @name with no message', () => {
    const result = parseIdentity('@Alice');

    expect(result.username).toBe('Alice');
    expect(result.cleanText).toBe('');
  });

  it('should only parse first @name', () => {
    const result = parseIdentity('@Alice told @Bob something');

    expect(result.username).toBe('Alice');
    expect(result.cleanText).toBe('told @Bob something');
  });

  it('should handle @name with extra whitespace', () => {
    const result = parseIdentity('  @Alice   Read 20 pages  ');

    expect(result.username).toBe('Alice');
    expect(result.cleanText).toBe('Read 20 pages');
  });

  it('should not parse @name if not at start', () => {
    const result = parseIdentity('Hello @Alice');

    expect(result.username).toBeNull();
    expect(result.cleanText).toBe('Hello @Alice');
  });

  it('should handle @name with numbers', () => {
    const result = parseIdentity('@Alice123 Did homework');

    expect(result.username).toBe('Alice123');
    expect(result.cleanText).toBe('Did homework');
  });

  it('should handle @name with underscore', () => {
    const result = parseIdentity('@Alice_B Read book');

    expect(result.username).toBe('Alice_B');
    expect(result.cleanText).toBe('Read book');
  });

  it('should not parse @ followed by space', () => {
    const result = parseIdentity('@ Alice Read book');

    expect(result.username).toBeNull();
    expect(result.cleanText).toBe('@ Alice Read book');
  });
});
