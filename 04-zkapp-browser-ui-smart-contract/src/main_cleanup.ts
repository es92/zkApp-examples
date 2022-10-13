import { Add } from './Add.js';
import {
  isReady,
  shutdown,
  Mina,
  PrivateKey,
  AccountUpdate,
  fetchAccount,
} from 'snarkyjs';

(async function main() {
  await isReady;

  console.log('SnarkyJS loaded')

  // ----------------------------------------------------

  const Berkeley = Mina.BerkeleyQANet(
    'https://proxy.berkeley.minaexplorer.com/graphql'
  );
  Mina.setActiveInstance(Berkeley);

  let transactionFee = 100_000_000;

  const deployerAccount = PrivateKey.fromBase58(process.argv[2]);
  const zkAppPrivateKey = PrivateKey.fromBase58(process.argv[3]);

  console.log('using deployer private key with public key', deployerAccount.toPublicKey().toBase58());
  console.log('using zkApp private key with public key', zkAppPrivateKey.toPublicKey().toBase58());

  // ----------------------------------------------------

  let response = await fetchAccount({ publicKey: deployerAccount.toPublicKey() });
  if (response.error) throw Error(response.error.statusText);
  let { nonce, balance } = response.account;
  console.log(`Using fee payer account with nonce ${nonce}, balance ${balance}`);

  // ----------------------------------------------------

  console.log('Compiling smart contract...');
  let { verificationKey } = await Add.compile();

  const zkAppAddress = zkAppPrivateKey.toPublicKey();
  let zkapp = new Add(zkAppAddress);
  let x = await zkapp.num.fetch();
  let isDeployed = (x != null && x.equals(0).not().toBoolean()); // This will change in a future version of SnarkyJS

  console.log('isDeployed:', isDeployed);

  // ----------------------------------------------------

  if (!isDeployed) {
    console.log(`Deploying zkapp for public key ${zkAppAddress.toBase58()}.`);
    let transaction = await Mina.transaction(
      { feePayerKey: deployerAccount, fee: transactionFee },
      () => {
        AccountUpdate.fundNewAccount(deployerAccount);
        zkapp.init();
        zkapp.deploy({ zkappKey: zkAppPrivateKey, verificationKey });
      }
    );
    // if you want to inspect the transaction, you can print it out:
    //console.log(transaction.toGraphqlQuery());

    console.log('Sending the deploy transaction...');
    const res = await transaction.send();
    const hash = await res.hash(); // This will change in a future version of SnarkyJS
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
    isDeployed = (x != null && x.equals(0).not().toBoolean()); // This will change in a future version of SnarkyJS
  }

  // ----------------------------------------------------

  const xBefore = x;
  console.log('Found deployed zkapp, updating state', x!.toString(), '->', x!.add(1).toString());
  let transaction = await Mina.transaction(
    { feePayerKey: deployerAccount , fee: transactionFee },
    () => {
      zkapp.update(x!.add(1));
    }
  );

  // fill in the proof - this can take a while...
  console.log('Creating an execution proof...');
  const time0 = Date.now();
  await transaction.prove();
  const time1 = Date.now();
  console.log('creating proof took', (time1 - time0)/1e3, 'seconds')

  // if you want to inspect the transaction, you can print it out:
  // console.log(transaction.toGraphqlQuery());

  console.log('Sending the transaction...');
  const res = await transaction.send();
  const hash = await res.hash(); // This will change in a future version of SnarkyJS
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
    stateChange = (x != null && x.equals(xBefore!).not().toBoolean());
  }
  console.log('updated state!', x!.toString());

  // ----------------------------------------------------

  console.log('Shutting down')

  await shutdown();
})();

