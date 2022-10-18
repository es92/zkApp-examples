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

//import { deploy } from './deploy.js';
import fs from 'fs';
import { loopUntilAccountExists, makeAndSendTransaction } from './utils.js';

(async function main() {
  await isReady;

  console.log('SnarkyJS loaded');

  // ----------------------------------------------------

  const Berkeley = Mina.BerkeleyQANet(
    'https://proxy.berkeley.minaexplorer.com/graphql'
  );
  Mina.setActiveInstance(Berkeley);

  let transactionFee = 100_000_000;

  const configName = process.argv[2];

  const deployerKeysFileContents = fs.readFileSync(
    'keys/' + configName + '.json',
    'utf8'
  );
  const deployerPrivateKeyBase58 = JSON.parse(
    deployerKeysFileContents
  ).privateKey;
  const deployerPrivateKey = PrivateKey.fromBase58(deployerPrivateKeyBase58);

  const zkAppPrivateKey = deployerPrivateKey;

  // ----------------------------------------------------

  let account = await loopUntilAccountExists(
    deployerPrivateKey.toPublicKey(),
    () => {
      console.log(
        'Deployer account does not exist. ' +
          'Request funds at faucet ' +
          'https://faucet.minaprotocol.com/?address=' +
          deployerPrivateKey.toPublicKey().toBase58()
      );
    }
  );
  console.log(
    `Using fee payer account with nonce ${account.nonce}, balance ${account.balance}`
  );

  // ----------------------------------------------------

  console.log('Compiling smart contract...');
  let { verificationKey } = await Square.compile();

  const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
  let zkapp = new Square(zkAppPublicKey);

  // Programmatic deploy:
  //   Besides the CLI, you can also create accounts programmatically. This is useful if you need
  //   more custom account creation - say deploying a zkApp to a different key than the fee payer
  //   key, programmatically parameterizing a zkApp before initializing it, or creating Smart
  //   Contracts programmatically for users as part of an application.
  //await deploy(deployerPrivateKey, zkAppPrivateKey, zkAppPublicKey, zkapp, verificationKey)

  // ----------------------------------------------------

  let isZkAppAccount = true;
  let zkAppAccount = await loopUntilAccountExists(
    zkAppPrivateKey.toPublicKey(),
    () => {
      console.log('waiting for zkApp account to be deployed...');
    },
    isZkAppAccount
  );

  // TODO when available in the future, use isProved.
  const allZeros = zkAppAccount.appState!.every((f) =>
    f.equals(Field.zero).toBoolean()
  );
  const needsInitialization = allZeros;

  if (needsInitialization) {
    console.log('initializing smart contract');
    await makeAndSendTransaction(
      deployerPrivateKey,
      zkAppPublicKey,
      () => zkapp.init(),
      transactionFee,
      () => zkapp.num.get(),
      (num1, num2) => num1.equals(num2).toBoolean()
    );

    console.log('updated state!', zkapp.num.get().toString());
  }

  let num = (await zkapp.num.get())!;
  console.log('current value of num is', num.toString());

  // ----------------------------------------------------

  await makeAndSendTransaction(
    deployerPrivateKey,
    zkAppPublicKey,
    () => zkapp.update(num.mul(num)),
    transactionFee,
    () => zkapp.num.get(),
    (num1, num2) => num1.equals(num2).toBoolean()
  );

  console.log('updated state!', zkapp.num.get().toString());

  // ----------------------------------------------------

  console.log('Shutting down');

  await shutdown();
})();
