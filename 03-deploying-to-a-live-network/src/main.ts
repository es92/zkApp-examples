import { Square } from './Square.js';
import {
  isReady,
  shutdown,
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  fetchAccount,
} from 'snarkyjs';

(async function main() {
  await isReady;

  console.log('SnarkyJS loaded')

  const Berkeley = Mina.BerkeleyQANet(
    'https://proxy.berkeley.minaexplorer.com/graphql'
  );
  Mina.setActiveInstance(Berkeley);

  // to use this test, change this private key to an account which has enough MINA to pay fees
  const deployerAccount = PrivateKey.fromBase58(process.argv[2]);
  console.log('using private key with public key', deployerAccount.toPublicKey().toBase58());

  // ----------------------------------------------------

  let response = await fetchAccount({ publicKey: deployerAccount.toPublicKey() });
  if (response.error) throw Error(response.error.statusText);
  let { nonce, balance } = response.account;
  console.log(`Using fee payer account with nonce ${nonce}, balance ${balance}`);

  // create a destination we will deploy the smart contract to
  const zkAppPrivateKey = PrivateKey.fromBase58(process.argv[3]);
  const zkAppAddress = zkAppPrivateKey.toPublicKey();

  let transactionFee = 100_000_000;

  // ----------------------------------------------------

  // compile the SmartContract to get the verification key (if deploying) or cache the provers (if updating)
  console.log('Compiling smart contract...');
  let { verificationKey } = await Square.compile();

  let zkapp = new Square(zkAppAddress);
  let x = await zkapp.num.fetch();
  let isDeployed = (x != null && x.equals(0).not().toBoolean()); // is there a better way to check this? What if I had a zkApp that could take on any value in any of its state variables? -- null means its not a zkApp account -- maybe non null, and pull verification key and see if its the same? -- isDeployed to exist later

  console.log('isDeployed:', isDeployed);

  // ----------------------------------------------------

  if (!isDeployed) {
    console.log(`Deploying zkapp for public key ${zkAppAddress.toBase58()}.`);
    // the `transaction()` interface is the same as when testing with a local blockchain
    let transaction = await Mina.transaction(
      { feePayerKey: deployerAccount, fee: transactionFee },
      () => {
        AccountUpdate.fundNewAccount(deployerAccount); // fund new account is putting funds towards a new account; if its not a new account then all the fees aren't accounted for
        // TODO shouldn't the init effect the verification key? Seems I can deploy discluding this (thereby putting the zkApp in state 0 - does this imply I could start the zkApp out in any state? Even a state that "should" need a proof to be reached?) ---- there is an issue for this
        zkapp.init();
        zkapp.deploy({ zkappKey: zkAppPrivateKey, verificationKey });
        // zkapp.sign(zkAppPrivateKey); -- not needed for a new deploy. Potentially needed for a redeploy TODO Nathan can explain more (Nathan mentioned something on nonces that could be explained)
      }
    );
    // if you want to inspect the transaction, you can print it out:
    //console.log(transaction.toGraphqlQuery());

    // send the transaction to the graphql endpoint
    console.log('Sending the deploy transaction...');
    const res = await transaction.send();
    const hash = await res.hash(); // TODO this has changed in the latest version. Has not been pushed to npm yet. Currently errors print to console. This may be optional, and possible to retrieve from cli in the latest version
    if (hash == null) {
      console.log('error sending transaction (see above)');
    } else {
      console.log('See deploy transaction at', 'https://berkeley.minaexplorer.com/transaction/' + hash);
    }
  }

  // ----------------------------------------------------

  while (!isDeployed) {
    console.log('waiting for zkApp to be deployed...')
    await new Promise(resolve => setTimeout(resolve, 5000))
    x = await zkapp.num.fetch();
    isDeployed = (x != null && x.equals(0).not().toBoolean());
  }

  // ----------------------------------------------------

  x = zkapp.num.get(); // TODO what is get vs fetch?
  const xBefore = x;
  console.log('Found deployed zkapp, updating state', x.toString(), '->', x.mul(x).toString());
  let transaction = await Mina.transaction(
    { feePayerKey: deployerAccount , fee: transactionFee },
    () => {
      zkapp.update(x!.mul(x!));
    }
  );
  // fill in the proof - this can take a while...
  console.log('Creating an execution proof...');
  const time0 = Date.now();
  await transaction.prove(); // TODO this is taking ~1 minute on my machine... seems a bit slow for x -> x^2? Maybe there's a "base" cost?
  const time1 = Date.now();
  console.log('creating proof took', (time1 - time0)/1e3, 'seconds')

  // if you want to inspect the transaction, you can print it out:
  // console.log(transaction.toGraphqlQuery());

  // send the transaction to the graphql endpoint
  console.log('Sending the transaction...');
  const res = await transaction.send();
  const hash = await res.hash(); // TODO this has changed in the latest version. Has not been pushed to npm yet.
  if (hash == null) {
    console.log('error sending transaction (see above)');
  } else {
    console.log('See transaction at', 'https://berkeley.minaexplorer.com/transaction/' + hash);
  }

  // ----------------------------------------------------

  let stateChange = false;

  while (!stateChange) {
    console.log('waiting for zkApp state to change... (current state: ', x!.toString() + ')')
    await new Promise(resolve => setTimeout(resolve, 5000))
    x = await zkapp.num.fetch();
    stateChange = (x != null && x.equals(xBefore).not().toBoolean());
  }
  console.log('updated state!', x!.toString());

  // ----------------------------------------------------

  console.log('Shutting down')

  await shutdown();
})();
