import 'reflect-metadata';
import type { Contract as ChaincodeContract } from 'fabric-contract-api';
import type { Network } from 'fabric-network';

import type RemoveFirstArgOfFunctionsAndIntersectingFromParent from '@pratikpc/removefirstargfromallfunctionofclassandintersectingfromparent';

import { extractAllAsyncFunctions, Objectify, Stringify } from './utils';

function extractContractName(contract: unknown, contractName?: string) {
  if (contractName != null) return contractName;

  if (typeof contract !== 'object')
    throw new Error('Error:- Contract is not an object');
  if (contract == null) throw new Error('Error:- Contract cannot be null');

  // If Name not provided
  // Extract from Info Metadata
  const info = Object.values(
    Reflect.getMetadata('fabric:info', global) ||
      Reflect.getMetadata('fabric:info', contract)
  )[0] as {
    name?: string;
    title?: string;
    DeployedChainCodeName?: string;
  };

  const name =
    (info && info.DeployedChainCodeName) ||
    (info && info.title) ||
    (info && info.name) ||
    (contract as { name: string }).name;

  if (name == null)
    throw new Error(
      'Contract name must be provided as optional parameter if not set via info. By default we use Contract Name'
    );
  return name;
}

function extractNetworkContract(
  contract: unknown,
  network: Network,
  contractName?: string
) {
  const name = contractName || extractContractName(contract, contractName);
  return network.getContract(name);
}
function extractInvocableFunctioNames(contract: unknown) {
  if (typeof contract !== 'object')
    throw new Error('Error:- Contract is not an object');
  if (contract == null) throw new Error('Error:- Contract cannot be null');
  const transactions = (
    (Reflect.getMetadata(
      // Transaction Metadata reflections set by Transaction
      // This is what we extract from the metadata
      // Of the object
      'fabric:transactions',
      contract
    ) || []) as {
      name: string;
      tag: string[];
      returns?: { type: string };
    }[]
  )
    .map((obj) => {
      return {
        ...obj,
        returns: obj.returns?.type
      } as {
        name: string;
        tag: string[];
        returns?: string;
      };
    })
    // Extract all where tags are present
    .filter(({ tag }) => tag != null && tag.length !== 0);
  // If the length is 0, set all as the invocable functions
  if (transactions.length === 0) {
    const functions = extractAllAsyncFunctions(contract);
    const notSupportedFunctions = [
      'afterTransaction',
      'beforeTransaction',
      'unknownTransaction'
    ];
    // Return all functions
    // Assume all of them are decorators
    const submitFunctions = functions
      // Skip functions which are not supported
      // So that we do not end up modifying them
      .filter((funcName) => !notSupportedFunctions.includes(funcName))
      .map((func) => ({
        name: func,
        returns: undefined
      }));
    return [
      submitFunctions,
      [
        /* No evaluate functions */
      ]
    ];
  }
  // All functions here on have been tagged
  const submitFunctions = transactions
    .filter(
      ({ tag }) =>
        // All transactions are tagged with SUBMIT and/or submitTx
        tag.includes('SUBMIT') || tag.includes('submitTx')
    )
    .map(({ name, returns }) => ({
      name: name,
      returns: returns
    }));
  const evaluateFunctions = transactions
    .filter(({ tag }) =>
      // All transactions are tagged with EVALUATE
      tag.includes('EVALUATE')
    )
    .map(({ name, returns }) => ({
      name: name,
      returns: returns
    }));
  return [submitFunctions, evaluateFunctions];
}

export default function ContractClient<T extends ChaincodeContract>(
  Ctrl: new (...content: any[]) => T,
  network: Network,
  contractName?: string
): // This exists for Intellisense support
// Ensures contract.sayHi(number) actually works
// Removes Common Parent and Child functions
RemoveFirstArgOfFunctionsAndIntersectingFromParent<ChaincodeContract, T> {
  const client = contractName != null ? new Ctrl(contractName) : new Ctrl();

  const contract = extractNetworkContract(client, network, contractName);
  const [submitFunctionNames, evaluateFunctionNames] =
    extractInvocableFunctioNames(client);

  if (submitFunctionNames.length === 0)
    throw new Error(
      'No functions provided to submit contract. Please add a few functions or add annotations to functions if possible'
    );

  for (const { name: functionName, returns } of submitFunctionNames) {
    // We have extracted a set of all possible submitFunctionNames
    // Now we shall reassign them to a function which shall submit the transaction
    // Note that given that we are expecting our users to utilize TypeScript
    // The user will not see this definition but instead the traditional typing
    // We expect user to use their traditional typing
    (client as any)[functionName] = async (...args: any[]) => {
      // submitTransaction takes argument as String
      const stringArgs = args.map((arg) => Stringify(arg));
      // Hide submit transaction away
      const result = await contract.submitTransaction(
        functionName,
        ...stringArgs
      );
      // Result returned is a buffer and needs to be converted into an object
      // Or type as set by the user
      return Objectify(result.toString(), returns);
    };
  }
  for (const { name: functionName, returns } of evaluateFunctionNames) {
    // We have extracted a set of all possible evaluateFunctionNames
    // Now we shall reassign them to a function which shall evaluate the transaction
    // Note that given that we are expecting our users to utilize TypeScript
    // The user will not see this definition but instead the traditional typing
    // We expect user to use their traditional typing
    (client as any)[functionName] = async (...args: any[]) => {
      // evaluateTransaction takes argument as String
      const stringArgs = args.map((arg) => Stringify(arg));
      const result = await contract.evaluateTransaction(
        functionName,
        ...stringArgs
      );
      // Result returned is a buffer and needs to be converted into an object
      // Or type as set by the user
      return Objectify(result.toString(), returns);
    };
  }
  return client as any;
}
