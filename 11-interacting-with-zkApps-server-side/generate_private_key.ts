import { PrivateKey, isReady, shutdown } from 'snarkyjs';

await isReady;

let privateKey = PrivateKey.random();
let publicKey = privateKey.toPublicKey();

console.log('private key:', privateKey.toBase58());
console.log('public key:', publicKey.toBase58());

await shutdown();
