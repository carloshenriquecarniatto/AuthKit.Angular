import { AUTHKIT_CONTRACT, loadContract } from '@authkit/contracts/testing';

/**
 * Guards `authkit.contract.json` from `@authkit/contracts`. The .NET SDK runs an equivalent
 * reflection-based test against the same JSON, so a change that is not applied on both sides fails
 * the build. The Aurelia SDK imports the same package and the same helper.
 */
describe('AuthKit contract parity', () => {
  const contract = loadContract() as {
    contractVersion: string;
    types: Record<string, { fields?: Record<string, string>; enum?: string[] }>;
    operations: { name: string }[];
  };

  it('declares the same contract version', () => {
    expect(contract.contractVersion).toBe(AUTHKIT_CONTRACT.contractVersion);
  });

  it('declares the same types and fields as the TypeScript SDK', () => {
    const declared = Object.keys(contract.types)
      .filter((name) => contract.types[name].fields !== undefined)
      .sort();

    expect(declared.sort()).toEqual(Object.keys(AUTHKIT_CONTRACT.types).sort());

    for (const typeName of declared) {
      const expected = Object.keys(contract.types[typeName].fields!).sort();
      const actual = [...AUTHKIT_CONTRACT.types[typeName]].sort();
      expect(actual, `${typeName} fields`).toEqual(expected);
    }
  });

  it('declares the same enum values', () => {
    expect(contract.types['AuthErrorCode'].enum).toEqual([...AUTHKIT_CONTRACT.errorCodes]);
    expect(contract.types['AuthState'].enum).toEqual([...AUTHKIT_CONTRACT.states]);
    expect(contract.types['AuthNextStep'].enum).toEqual([...AUTHKIT_CONTRACT.nextSteps]);
    expect(contract.types['AuthMessageKey'].enum).toEqual([...AUTHKIT_CONTRACT.messageKeys]);
  });

  it('declares the same operations', () => {
    expect(contract.operations.map((operation) => operation.name)).toEqual([
      ...AUTHKIT_CONTRACT.operations,
    ]);
  });
});
