describe('Jest Configuration', () => {
  it('should be able to run tests', () => {
    expect(true).toBe(true);
  });

  it('should have proper TypeScript support', () => {
    const value: string = 'test';
    expect(typeof value).toBe('string');
  });

  it('should support async/await', async () => {
    const promise = Promise.resolve('success');
    const result = await promise;
    expect(result).toBe('success');
  });
});
