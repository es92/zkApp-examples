import React, { useEffect, useState, ReactElement } from "react";

import { Stage, createUseMakeStage, createGetStageComponent } from "./utils";

import { Add, snarkyjs } from "04-zkapp-browser-ui-smart-contract";

const {
  Mina,
  Field,
  PublicKey,
  PrivateKey,
  isReady,
  fetchAccount,
  setGraphqlEndpoint,
} = snarkyjs;

type OnReady = (
  publicKey: InstanceType<typeof PublicKey>,
  privateKey: InstanceType<typeof PrivateKey>,
  zkapp: InstanceType<typeof Add>,
  initialState: InstanceType<typeof Field>
) => void;

function Initialize({
  onReady,
  mockEffects,
}: {
  onReady: OnReady;
  mockEffects: boolean;
}) {
  // --------------------------------------------------------------------

  let [state, setState] = useState({
    stages: {
      loadSnarkyJS: { stage: Stage.NotStarted, time: null } as {
        stage: Stage;
        time: null | number;
      },
      makeOrGetKey: { stage: Stage.NotStarted, time: null } as {
        stage: Stage;
        time: null | number;
      },
      checkAccountFunded: { stage: Stage.NotStarted, time: null } as {
        stage: Stage;
        time: null | number;
      },
      waitForAccountFunded: { stage: Stage.NotStarted, time: null } as {
        stage: Stage;
        time: null | number;
      },
      compileZKApp: { stage: Stage.NotStarted, time: null } as {
        stage: Stage;
        time: null | number;
      },
      fetchState: { stage: Stage.NotStarted, time: null } as {
        stage: Stage;
        time: null | number;
      },
    },
    publicKey: null as InstanceType<typeof PublicKey> | null,
    privateKey: null as InstanceType<typeof PrivateKey> | null,
    madeKey: false,
    firstCheckFoundKey: false,
    foundAccount: false,
    zkapp: null as InstanceType<typeof Add> | null,
    initialState: null as InstanceType<typeof Field> | null,
  });

  const useMakeStage = createUseMakeStage(state, setState);
  const getStageComponent = createGetStageComponent(state);

  // --------------------------------------------------------------------

  useMakeStage(null, "loadSnarkyJS", async (state) => {
    await isReady;

    const Berkeley = Mina.BerkeleyQANet(
      "https://proxy.berkeley.minaexplorer.com/graphql"
    );
    Mina.setActiveInstance(Berkeley);

    return state;
  });

  // --------------------------------------------------------------------

  useMakeStage("loadSnarkyJS", "makeOrGetKey", async (state) => {
    console.log("getting keys");
    var makeNewKey = localStorage.privateKey == null;

    if (makeNewKey) {
      localStorage.privateKey = PrivateKey.random().toBase58();
    }

    let privateKey = PrivateKey.fromBase58(localStorage.privateKey);
    let publicKey = privateKey.toPublicKey();

    return {
      ...state,
      madeKey: makeNewKey,
      publicKey,
      privateKey,
    };
  });

  // --------------------------------------------------------------------

  useMakeStage("makeOrGetKey", "checkAccountFunded", async (state) => {
    let response = mockEffects
      ? { error: null }
      : await fetchAccount({ publicKey: state.publicKey! });
    let firstCheckFoundKey = response.error == null;

    return { ...state, firstCheckFoundKey };
  });

  // --------------------------------------------------------------------

  useMakeStage("checkAccountFunded", "waitForAccountFunded", async (state) => {
    if (!state.firstCheckFoundKey) {
      let foundAccount = false;
      let t0 = Date.now();
      while (!foundAccount) {
        let response = mockEffects
          ? { error: null }
          : await fetchAccount({ publicKey: state.publicKey! });
        foundAccount = response.error == null;
        if (!foundAccount) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    }

    return { ...state, foundAccount: true };
  });

  // --------------------------------------------------------------------

  useMakeStage("waitForAccountFunded", "compileZKApp", async (state) => {
    var zkAppAddress = PublicKey.fromBase58(
      "B62qkLob7sbrvnTMjTdXsxrfLTydBgENiPh1TxBc5KGSvdiX8NT7qvY"
    );

    // to give UI a chance to refresh
    await new Promise((resolve) => setTimeout(resolve, 500));
    let { verificationKey } = mockEffects
      ? { verificationKey: null }
      : await Add.compile();

    let zkapp = new Add(zkAppAddress);

    return { ...state, zkapp };
  });

  // --------------------------------------------------------------------

  useMakeStage("compileZKApp", "fetchState", async (state) => {
    let num = mockEffects
      ? Field.fromNumber(1)
      : await state.zkapp!.num.fetch();

    return { ...state, initialState: num! };
  });

  // --------------------------------------------------------------------

  const loading = getStageComponent(
    "loadSnarkyJS",
    "Loading SnarkyJS",
    () => null
  );

  const makeOrGetKey = getStageComponent("makeOrGetKey", "Getting Key", () => {
    return (
      <div>
        {" "}
        {state.madeKey ? "Created new key: " : "Found key: "}
        {state.publicKey!.toBase58()}
      </div>
    );
  });

  const firstCheck = getStageComponent(
    "checkAccountFunded",
    "Checking account exists...",
    () => {
      var faucet_link =
        "https://faucet.minaprotocol.com/?address=" +
        state.publicKey!.toBase58();
      let accoutState;
      if (state.firstCheckFoundKey) {
        accoutState = <div>Account exists</div>;
      } else {
        accoutState = (
          <div>
            Account does not exist. Request funds at faucet
            <a href={faucet_link} target="_blank">
              [link]
            </a>
          </div>
        );
      }
      return accoutState;
    }
  );

  let foundAccount = null;
  if (!state.firstCheckFoundKey) {
    foundAccount = getStageComponent(
      "waitForAccountFunded",
      "Waiting for account to be created",
      () => <div> Account created </div>
    );
  }

  const compiling = getStageComponent(
    "compileZKApp",
    "Compiling smart contract",
    () => null
  );

  let gotoApp = () => {
    onReady(
      state.publicKey!,
      state.privateKey!,
      state.zkapp!,
      state.initialState!
    );
  };

  const initialState = getStageComponent(
    "fetchState",
    "Fetching current state",
    () => {
      return (
        <div>
          <div> Current state: {state.initialState!.toString()} </div>
          <div> Initialized. </div>
          <a href="#" onClick={gotoApp}>
            {" "}
            Start app -&gt;{" "}
          </a>
        </div>
      );
    }
  );

  return (
    <div className="console">
      {loading}
      {makeOrGetKey}
      {firstCheck}
      {foundAccount}
      {compiling}
      {initialState}
    </div>
  );
}

export { Initialize };
export type { OnReady };
