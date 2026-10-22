import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { AUTHKIT_CONTRACT } from './auth.models';

/**
 * Guards contracts/authkit.contract.json. The .NET SDK runs an equivalent reflection-based
 * test, so a contract change that is not applied on both sides fails the build.
 */
function loadContract(): any {
  let directory = process.cwd();

  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = join(directory, 'contracts', 'authkit.contract.json');
    if (existsSync(candidate)) {
      return JSON.parse(readFileSync(candidate, 'utf8'));
    }
    directory = dirname(directory);
  }

  throw new Error('contracts/authkit.contract.json was not found from the test working directory.');
}

describe('AuthKit contract parity', () => {
  const contract = loadContract();

  it('declares the same contract version', () => {
    expect(contract.contractVersion).toBe(AUTHKIT_CONTRACT.contractVersion);
  });

  it('declares the same types and fields as the TypeScript SDK', () => {
    const declared = Object.keys(contract.types).filter((name) => contract.types[name].fields);
    expect(declared.sort()).toEqual(Object.keys(AUTHKIT_CONTRACT.types).sort());

    for (const typeName of declared) {
      const expected = Object.keys(contract.types[typeName].fields).sort();
      const actual = [
        ...AUTHKIT_CONTRACT.types[typeName as keyof typeof AUTHKIT_CONTRACT.types],
      ].sort();
      expect(actual, `${typeName} fields`).toEqual(expected);
    }
  });

  it('declares the same enum values', () => {
    expect(contract.types.AuthErrorCode.enum).toEqual([...AUTHKIT_CONTRACT.errorCodes]);
    expect(contract.types.AuthState.enum).toEqual([...AUTHKIT_CONTRACT.states]);
    expect(contract.types.AuthNextStep.enum).toEqual([...AUTHKIT_CONTRACT.nextSteps]);
    expect(contract.types.AuthMessageKey.enum).toEqual([...AUTHKIT_CONTRACT.messageKeys]);
  });

  it('declares the same operations', () => {
    const operations = contract.operations.map((operation: { name: string }) => operation.name);
    expect(operations).toEqual([...AUTHKIT_CONTRACT.operations]);
  });
});
