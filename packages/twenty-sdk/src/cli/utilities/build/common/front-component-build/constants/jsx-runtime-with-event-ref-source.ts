export const JSX_RUNTIME_WITH_EVENT_REF_SOURCE = `
export function withJsxEventRef(props) {
  const { cleanProps, events } = splitEventProps(props);
  cleanProps.ref = makeEventRef(events, cleanProps.ref, 'jsx');
  return cleanProps;
}

function doesCloneConfigReplaceElementRef(config, elementRef) {
  return (
    config != null && config.ref !== undefined && config.ref !== elementRef
  );
}

function getElementRef(element, readsElementRefFromVnode) {
  if (readsElementRefFromVnode) {
    return element.ref;
  }

  return element.props.ref;
}

function isEventRef(ref) {
  return typeof ref === 'function' && ref._eventSource !== undefined;
}

function isCloneEventRef(ref) {
  return ref != null && ref._eventSource === 'clone';
}

function isJsxEventRef(ref) {
  return ref != null && ref._eventSource === 'jsx';
}

function getOuterWinningCloneEventsOf(cloneEventRef) {
  return cloneEventRef._outerWinningCloneEvents || cloneEventRef._eventProps;
}

function findJsxEventRefOf(ref) {
  let currentRef = ref;
  while (isCloneEventRef(currentRef)) {
    currentRef = currentRef._userRef;
  }

  return isJsxEventRef(currentRef) ? currentRef : null;
}

function doesCloneConfigSetEventProp(config, eventPropName) {
  if (!(eventPropName in config)) {
    return false;
  }

  const eventPropValue = config[eventPropName];
  return typeof eventPropValue === 'function' || eventPropValue == null;
}

function isAnyEventPropOverridden(events, isEventPropOverridden) {
  for (const eventPropName in events) {
    if (isEventPropOverridden(eventPropName)) {
      return true;
    }
  }
  return false;
}

function omitOverriddenEventProps(events, isEventPropOverridden) {
  let remainingEvents = null;
  for (const eventPropName in events) {
    if (!isEventPropOverridden(eventPropName)) {
      remainingEvents = remainingEvents || {};
      remainingEvents[eventPropName] = events[eventPropName];
    }
  }
  return remainingEvents;
}

function replaceJsxEventRefUserRef(jsxEventRef, userRef) {
  const lastUserRefReplacement = jsxEventRef._lastUserRefReplacement;
  const canReuseLastUserRefReplacement =
    lastUserRefReplacement !== undefined &&
    lastUserRefReplacement._userRef === userRef;
  if (canReuseLastUserRefReplacement) {
    return lastUserRefReplacement;
  }

  const userRefReplacement = createEventRef(
    jsxEventRef._eventProps,
    userRef,
    'jsx',
  );
  jsxEventRef._lastUserRefReplacement = userRefReplacement;
  return userRefReplacement;
}

function makeJsxEventRefNotOverriddenByClone(elementRef, config) {
  const jsxEventRef = findJsxEventRefOf(elementRef);
  if (jsxEventRef === null) {
    return config.ref;
  }

  const innerOuterWinningCloneEvents = isCloneEventRef(elementRef)
    ? getOuterWinningCloneEventsOf(elementRef)
    : null;
  const isJsxEventPropOverriddenByClone = (eventPropName) =>
    doesCloneConfigSetEventProp(config, eventPropName) ||
    (innerOuterWinningCloneEvents !== null &&
      eventPropName in innerOuterWinningCloneEvents);
  const jsxEvents = jsxEventRef._eventProps;
  if (!isAnyEventPropOverridden(jsxEvents, isJsxEventPropOverriddenByClone)) {
    return replaceJsxEventRefUserRef(jsxEventRef, config.ref);
  }

  return makeEventRef(
    omitOverriddenEventProps(jsxEvents, isJsxEventPropOverriddenByClone),
    config.ref,
    'jsx',
  );
}

function makeCloneEventRefOfNonCloneElementRef({
  elementRef,
  config,
  replacesElementUserRef,
  cloneEvents,
}) {
  const cloneUserRef = replacesElementUserRef
    ? makeJsxEventRefNotOverriddenByClone(elementRef, config)
    : elementRef;
  const canReuseCloneUserRef = !cloneEvents && isEventRef(cloneUserRef);
  if (canReuseCloneUserRef) {
    return cloneUserRef;
  }

  return makeEventRef(cloneEvents, cloneUserRef, 'clone');
}

function makeCloneEventRef({
  elementRef,
  config,
  replacesElementUserRef,
  cloneEvents,
}) {
  if (!isCloneEventRef(elementRef)) {
    return makeCloneEventRefOfNonCloneElementRef({
      elementRef,
      config,
      replacesElementUserRef,
      cloneEvents,
    });
  }

  const keepsInnerCloneUserRef = !replacesElementUserRef;
  if (keepsInnerCloneUserRef && !cloneEvents) {
    return elementRef;
  }

  const innerCloneEvents = elementRef._eventProps;
  const outerWinningCloneEvents = mergeCloneEventsOuterWinning(
    getOuterWinningCloneEventsOf(elementRef),
    cloneEvents,
  );
  const hasInnerOuterWinningCloneEvents =
    !!elementRef._outerWinningCloneEvents;
  if (keepsInnerCloneUserRef && !hasInnerOuterWinningCloneEvents) {
    return makeEventRef(outerWinningCloneEvents, elementRef._userRef, 'clone');
  }

  if (keepsInnerCloneUserRef) {
    return createEventRef(
      mergeCloneEventsOuterWinning(innerCloneEvents, cloneEvents),
      elementRef._userRef,
      'clone',
      outerWinningCloneEvents,
    );
  }

  const cloneUserRef = makeJsxEventRefNotOverriddenByClone(elementRef, config);
  const chainedCloneEvents = chainCloneEvents(innerCloneEvents, cloneEvents);
  if (chainedCloneEvents === null) {
    return makeEventRef(null, cloneUserRef, 'clone');
  }

  return createEventRef(
    chainedCloneEvents,
    cloneUserRef,
    'clone',
    outerWinningCloneEvents,
  );
}

export function withCloneEventRef(element, config, readsElementRefFromVnode) {
  const { cleanProps: cleanConfig, events: cloneEvents } =
    splitEventProps(config);
  const elementRef = getElementRef(element, readsElementRefFromVnode);
  cleanConfig.ref = makeCloneEventRef({
    elementRef,
    config,
    replacesElementUserRef: doesCloneConfigReplaceElementRef(
      config,
      elementRef,
    ),
    cloneEvents,
  });
  return cleanConfig;
}
`.trim();
