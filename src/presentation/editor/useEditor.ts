import { onScopeDispose, ref, shallowRef, triggerRef } from 'vue'
import { editorSessionKey, injectStrict } from './injection'

/**
 * The editor session for Vue (ADR-0006): `state` is a shallow ref re-triggered on every event,
 * `version` counts events, because a patch changes the grid in place.
 */
export function useEditor() {
  const session = injectStrict(editorSessionKey)
  const state = shallowRef(session.state)
  const version = ref(0)

  onScopeDispose(
    session.subscribe(() => {
      state.value = session.state
      triggerRef(state)
      version.value++
    }),
  )

  return { state, version, dispatch: session.dispatch }
}
