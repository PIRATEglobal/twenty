export const JSX_RUNTIME_WITH_EVENT_REF_SOURCE = `
export function withJsxEventRef(props) {
  const { cleanProps, events } = splitEventProps(props);
  cleanProps.ref = makeEventRef(events, cleanProps.ref, 'jsx');
  return cleanProps;
}

function doesCloneConfigOverrideRef(config) {
  return config != null && config.ref !== undefined;
}

function getElementRef(element, readsElementRefFromVnode) {
  if (readsElementRefFromVnode) {
    return element.ref;
  }

  return element.props.ref;
}

function isCloneEventRef(ref) {
  return ref != null && ref._eventSource === 'clone';
}

function getOuterWinningCloneEventsOf(cloneEventRef) {
  return cloneEventRef._outerWinningCloneEvents || cloneEventRef._eventProps;
}

function findJsxEventRefOf(ref) {
  let currentRef = ref;
  while (isCloneEventRef(currentRef)) {
    currentRef = currentRef._userRef;
  }

  const isJsxEventRef =
    isEventRef(currentRef) && currentRef._eventSource === 'jsx';
  return isJsxEventRef ? currentRef : null;
}

function isEventPropOverriddenBy(eventPropName, overridingEvents) {
  return overridingEvents != null && eventPropName in overridingEvents;
}

function omitEventProps(events, omittedEvents) {
  const remainingEvents = {};
  for (const eventPropName in events) {
    if (!isEventPropOverriddenBy(eventPropName, omittedEvents)) {
      remainingEvents[eventPropName] = events[eventPropName];
    }
  }
  return remainingEvents;
}

function doOverridingEventPropsOverrideAnyEventProp(
  events,
  overridingEventProps,
) {
  for (const eventPropName in events) {
    if (isEventPropOverriddenBy(eventPropName, overridingEventProps)) {
      return true;
    }
  }
  return false;
}

function findClearedEventPropsOf(config) {
  let clearedEventProps = null;
  for (const propName in config) {
    const isClearedEventProp =
      EVENT_PROP_NAME_PATTERN.test(propName) && config[propName] == null;
    if (isClearedEventProp) {
      clearedEventProps = clearedEventProps || {};
      clearedEventProps[propName] = config[propName];
    }
  }
  return clearedEventProps;
}

function mergeClearedEventProps(events, clearedEventProps) {
  if (clearedEventProps === null) {
    return events;
  }

  return Object.assign({}, events, clearedEventProps);
}

function makeJsxEventRefNotOverriddenByClone({
  elementRef,
  userRef,
  overridingEventProps,
}) {
  const jsxEventRef = findJsxEventRefOf(elementRef);
  if (jsxEventRef === null) {
    return userRef;
  }

  const jsxEvents = jsxEventRef._eventProps;
  if (
    !doOverridingEventPropsOverrideAnyEventProp(jsxEvents, overridingEventProps)
  ) {
    return replaceInnermostUserRef(jsxEventRef, userRef);
  }

  return createEventRef(
    omitEventProps(jsxEvents, overridingEventProps),
    userRef,
    'jsx',
  );
}

function makeCloneEventRefOfNonCloneElementRef({
  elementRef,
  configRef,
  overridesElementRef,
  cloneEvents,
  clearedEventProps,
}) {
  const replacesElementUserRef =
    overridesElementRef && configRef !== elementRef;
  const cloneUserRef = replacesElementUserRef
    ? makeJsxEventRefNotOverriddenByClone({
        elementRef,
        userRef: configRef,
        overridingEventProps: mergeClearedEventProps(
          cloneEvents,
          clearedEventProps,
        ),
      })
    : elementRef;
  const canReuseCloneUserRef = !cloneEvents && isEventRef(cloneUserRef);
  if (canReuseCloneUserRef) {
    return cloneUserRef;
  }

  return makeEventRef(cloneEvents, cloneUserRef, 'clone');
}

function makeCloneEventRef({
  elementRef,
  configRef,
  overridesElementRef,
  cloneEvents,
  clearedEventProps,
}) {
  if (!isCloneEventRef(elementRef)) {
    return makeCloneEventRefOfNonCloneElementRef({
      elementRef,
      configRef,
      overridesElementRef,
      cloneEvents,
      clearedEventProps,
    });
  }

  const keepsInnerCloneUserRef =
    !overridesElementRef || configRef === elementRef;
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

  const cloneUserRef = makeJsxEventRefNotOverriddenByClone({
    elementRef,
    userRef: configRef,
    overridingEventProps: mergeClearedEventProps(
      outerWinningCloneEvents,
      clearedEventProps,
    ),
  });
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
  cleanConfig.ref = makeCloneEventRef({
    elementRef: getElementRef(element, readsElementRefFromVnode),
    configRef: config == null ? undefined : config.ref,
    overridesElementRef: doesCloneConfigOverrideRef(config),
    cloneEvents,
    clearedEventProps: findClearedEventPropsOf(config),
  });
  return cleanConfig;
}
`.trim();
