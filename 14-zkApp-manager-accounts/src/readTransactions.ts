
// TODO add call stack computation

import fs from 'fs';
import util from 'util';

import graphviz from 'graphviz'

const dir = 'transactions';

let txnFiles = fs.readdirSync(dir);
txnFiles = txnFiles.filter((f) => f.indexOf('transaction') != -1);
txnFiles = txnFiles.filter((f) => f.indexOf('.png') == -1);

const txns = txnFiles.map((f) => ({ name: f.split('.')[0].split('-').slice(1).join('-'), 
                                    content: JSON.parse(fs.readFileSync(dir + '/' + f, 
                                                                    { encoding:'utf8', flag:'r' })) }));
;

const legend = JSON.parse(fs.readFileSync(dir + '/legend.json', { encoding:'utf8', flag:'r' }))

function removeNull(obj: any) {
  if (obj == null) {
    return null;
  } else if (typeof obj == 'object') {
    let allNull = true;
    for (let key of Object.keys(obj)) {
      let val = removeNull(obj[key]);
      if (val == null) {
        delete obj[key];
      } else {
        obj[key] = val;
        allNull = false;
      }
    }
    if (allNull) {
      return null;
    }
  }
  return obj;
}

function printTxn(txn: any) {
  console.log('='.repeat(80))
  console.log(txn.name, txn.content.accountUpdates.length);

  var g = graphviz.digraph("G");

  const legendShort: any = {};
  Object.keys(legend).forEach((k) => legendShort[k.slice(-6)] = legend[k]);

  const label = txn.name + '\\l\\l' + (JSON.stringify(legendShort, null, 2).replaceAll('"', "'")
                                                .split('\n')
                                                .map((t) => t.trim())
                                                .slice(1,-1)
                                                .join('\\l'));

  g.addNode('legend', { shape: 'box', label });

  const parentStack = []

  for (let [idx, au] of txn.content.accountUpdates.entries()) {
    if (au.authorization.proof != null) {
      au.authorization.proof = au.authorization.proof.slice(-6);
    }
    if (au.authorization.signature != null) {
      au.authorization.signature = au.authorization.signature.slice(-6);
    }
    if (au.body.authorizationKind.verificationKeyHash != null) {
      au.body.authorizationKind.verificationKeyHash = au.body.authorizationKind.verificationKeyHash.slice(-6);
    }
    if (au.body.update.verificationKey != null) {
      au.body.update.verificationKey.data = au.body.update.verificationKey.data.slice(-6);
      au.body.update.verificationKey.hash = au.body.update.verificationKey.hash.slice(-6);
    }
    if (au.body.update.appState != null) {
      if (au.body.update.appState.every((x: any) => x == '0'))  {
        au.body.update.appState = '0s';
      } else {
        au.body.update.appState = JSON.stringify(au.body.update.appState.map((u: any, i: any) => [ i, u ])
                                                  .filter((x: any) => x[1] != null));
      }
    }
    au.idx = idx;
    au.body.update = removeNull(au.body.update)
    au.body.preconditions = removeNull(au.body.preconditions)
    au.body.publicKey = au.body.publicKey.slice(-6);
    au.body.tokenId = au.body.tokenId.slice(-6);

    if (au.body.events.length == 0) {
      delete au.body.events;
    }
    if (au.body.actions.length == 0) {
      delete au.body.actions;
    }

    console.log('-'.repeat(80))
    console.log('accountUpdate Index', idx);
    console.log(util.inspect(au, {showHidden: false, depth: null, colors: true}))

    console.log(au.authorization.proof)
    let authorization;
    if (au.authorization.proof != null) {
      authorization = 'proof'
    } else if (au.authorization.signature != null) {
      authorization = 'signature'
    } else {
      authorization = 'none'
    }

    const content = {
      idx: au.idx,
      publicKey: au.body.publicKey.slice(-6),
      tokenId: au.body.tokenId.slice(-6),
      callDepth: au.body.callDepth,
      callData: au.body.callData.slice(-6),
      balanceChange: (au.body.balanceChange.sgn == 'Positive' ? '+' : '-') + (au.body.balanceChange.magnitude/1e9),
      update: au.body.update,     
      authorization
    }

    const label = JSON.stringify(content, null, 2).replaceAll('"', "'")
                                                  .split('\n')
                                                  //.map((t) => t.trim())
                                                  .slice(1,-1)
                                                  .join('\\l');

    const node = g.addNode(idx, { label, fontname: "monospace" });
    au.node = node;

    if (parentStack.length > 0) {
      const lastAu = parentStack[parentStack.length-1];
      if (au.body.callDepth <= lastAu.body.callDepth) {
        const diff = lastAu.body.callDepth - au.body.callDepth + 1;
        for (let i = 0; i < diff; i++) {
          parentStack.pop();
        }
      }

      if (parentStack.length > 0) {
        const parentAu = parentStack[parentStack.length-1];
        g.addEdge(parentAu.node, au.node);
      }
    }

    parentStack.push(au);
  }

  g.output( "png", 'transactions/' + txn.name + '.png');
  //console.log(g.to_dot());
}

for (let txn of txns) {
  printTxn(txn);
}

//printTxn(txns[4])

