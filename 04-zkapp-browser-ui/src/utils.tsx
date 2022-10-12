import React, { useEffect, useState, ReactElement,  } from 'react';

enum Stage {
  NotStarted,
  Started,
  Done
}

// TODO fix these types
let createUseMakeStage = (state: any, setState: any) => {
  type State = typeof state;

  const useMakeStage = ((priorStageName: keyof typeof state.stages | null, 
                         stageName: keyof typeof state.stages, 
                         fn: (state: State) => Promise<State>) => {
    useEffect(() => {
      (async () => {
        if (state.stages[stageName].stage == Stage.NotStarted 
            && (priorStageName == null || state.stages[priorStageName].stage == Stage.Done)) {
          console.log('starting stage', stageName);
          state = { ...state }
          state.stages[stageName].stage = Stage.Started;
          setState(state);
          let startTime = Date.now()
          state = await fn(state);
          state = { ...state }
          state.stages[stageName].stage = Stage.Done;
          state.stages[stageName].time = Date.now() - startTime;
          setState(state);
          console.log('finished stage', stageName);
        }
      })();
    }, priorStageName == null ? [] : [state.stages[priorStageName].stage]);
  });

  return useMakeStage;
}

// TODO fix these types
let createGetStageComponent = (state: any) => {
  let getStageComponent = (stage: keyof typeof state.stages, text: string, ifDone: () => ReactElement | null) => {
    var component = null;
    if (state.stages[stage].stage == Stage.Started) {
      component = <div> { text }... </div>
    } else if (state.stages[stage].stage == Stage.Done) {
      component = (<div>
                    <div> { text }... done ({ state.stages[stage].time }ms) </div>
                    { ifDone() }
                  </div>)
    }
    return component;
  };
  return getStageComponent;
}

export { Stage, createUseMakeStage, createGetStageComponent }
