/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

// TODO: direct imports like some-package/src/* are bad. Fix me.
import ReactDebugCurrentFiber from 'react-reconciler/src/ReactDebugCurrentFiber';
import invariant from 'fbjs/lib/invariant';
import warning from 'fbjs/lib/warning';

import * as DOMPropertyOperations from './DOMPropertyOperations';
import {getFiberCurrentPropsFromNode} from './ReactDOMComponentTree';
import ReactControlledValuePropTypes from '../shared/ReactControlledValuePropTypes';

type InputWithWrapperState = HTMLInputElement & {
  _wrapperState: {
    initialValue: ?string,
    initialChecked: ?boolean,
    controlled?: boolean,
  },
};

var {
  getCurrentFiberOwnerName,
  getCurrentFiberStackAddendum,
} = ReactDebugCurrentFiber;
var didWarnValueDefaultValue = false;
var didWarnCheckedDefaultChecked = false;
var didWarnControlledToUncontrolled = false;
var didWarnUncontrolledToControlled = false;

function isControlled(props) {
  var usesChecked = props.type === 'checkbox' || props.type === 'radio';
  return usesChecked ? props.checked != null : props.value != null;
}

/**
 * Implements an <input> host component that allows setting these optional
 * props: `checked`, `value`, `defaultChecked`, and `defaultValue`.
 *
 * If `checked` or `value` are not supplied (or null/undefined), user actions
 * that affect the checked state or value will trigger updates to the element.
 *
 * If they are supplied (and not null/undefined), the rendered element will not
 * trigger updates to the element. Instead, the props must change in order for
 * the rendered element to be updated.
 *
 * The rendered element will be initialized as unchecked (or `defaultChecked`)
 * with an empty value (or `defaultValue`).
 *
 * See http://www.w3.org/TR/2012/WD-html5-20121025/the-input-element.html
 */

export function getHostProps(element: Element, props: Object) {
  var node = ((element: any): InputWithWrapperState);
  var checked = props.checked;

  var hostProps = Object.assign({}, props, {
    defaultChecked: undefined,
    defaultValue: undefined,
    value: undefined,
    checked: checked != null ? checked : node._wrapperState.initialChecked,
  });

  return hostProps;
}

export function initWrapperState(element: Element, props: Object) {
  if (__DEV__) {
    ReactControlledValuePropTypes.checkPropTypes(
      'input',
      props,
      getCurrentFiberStackAddendum,
    );

    if (
      props.checked !== undefined &&
      props.defaultChecked !== undefined &&
      !didWarnCheckedDefaultChecked
    ) {
      warning(
        false,
        '%s contains an input of type %s with both checked and defaultChecked props. ' +
          'Input elements must be either controlled or uncontrolled ' +
          '(specify either the checked prop, or the defaultChecked prop, but not ' +
          'both). Decide between using a controlled or uncontrolled input ' +
          'element and remove one of these props. More info: ' +
          'https://fb.me/react-controlled-components',
        getCurrentFiberOwnerName() || 'A component',
        props.type,
      );
      didWarnCheckedDefaultChecked = true;
    }
    if (
      props.value !== undefined &&
      props.defaultValue !== undefined &&
      !didWarnValueDefaultValue
    ) {
      warning(
        false,
        '%s contains an input of type %s with both value and defaultValue props. ' +
          'Input elements must be either controlled or uncontrolled ' +
          '(specify either the value prop, or the defaultValue prop, but not ' +
          'both). Decide between using a controlled or uncontrolled input ' +
          'element and remove one of these props. More info: ' +
          'https://fb.me/react-controlled-components',
        getCurrentFiberOwnerName() || 'A component',
        props.type,
      );
      didWarnValueDefaultValue = true;
    }
  }

  var defaultValue = props.defaultValue == null ? '' : props.defaultValue;
  var node = ((element: any): InputWithWrapperState);
  node._wrapperState = {
    initialChecked:
      props.checked != null ? props.checked : props.defaultChecked,
    initialValue: props.value != null ? props.value : defaultValue,
    controlled: isControlled(props),
  };
}

export function updateWrapper(element: Element, props: Object) {
  var node = ((element: any): InputWithWrapperState);
  if (__DEV__) {
    var controlled = isControlled(props);

    if (
      !node._wrapperState.controlled &&
      controlled &&
      !didWarnUncontrolledToControlled
    ) {
      warning(
        false,
        'A component is changing an uncontrolled input of type %s to be controlled. ' +
          'Input elements should not switch from uncontrolled to controlled (or vice versa). ' +
          'Decide between using a controlled or uncontrolled input ' +
          'element for the lifetime of the component. More info: https://fb.me/react-controlled-components%s',
        props.type,
        getCurrentFiberStackAddendum(),
      );
      didWarnUncontrolledToControlled = true;
    }
    if (
      node._wrapperState.controlled &&
      !controlled &&
      !didWarnControlledToUncontrolled
    ) {
      warning(
        false,
        'A component is changing a controlled input of type %s to be uncontrolled. ' +
          'Input elements should not switch from controlled to uncontrolled (or vice versa). ' +
          'Decide between using a controlled or uncontrolled input ' +
          'element for the lifetime of the component. More info: https://fb.me/react-controlled-components%s',
        props.type,
        getCurrentFiberStackAddendum(),
      );
      didWarnControlledToUncontrolled = true;
    }
  }

  var checked = props.checked;
  if (checked != null) {
    DOMPropertyOperations.setValueForProperty(
      node,
      'checked',
      checked || false,
    );
  }

  var value = props.value;
  var valueAsString = '' + props.value;
  if (value != null) {
    if (value === 0 && node.value === '') {
      node.value = '0';
      // Note: IE9 reports a number inputs as 'text', so check props instead.
    } else if (props.type === 'number') {
      // Simulate `input.valueAsNumber`. IE9 does not support it
      var valueAsNumber = parseFloat(node.value) || 0;

      if (
        // eslint-disable-next-line
        value != valueAsNumber ||
        // eslint-disable-next-line
        (value == valueAsNumber && node.value != value)
      ) {
        // Cast `value` to a string to ensure the value is set correctly. While
        // browsers typically do this as necessary, jsdom doesn't.
        node.value = valueAsString;
      }
    } else if (node.value !== valueAsString) {
      // Cast `value` to a string to ensure the value is set correctly. While
      // browsers typically do this as necessary, jsdom doesn't.
      node.value = valueAsString;
    }
    synchronizeDefaultValue(node, props.type, valueAsString);
  } else {
    if (props.value == null && props.defaultValue != null) {
      synchronizeDefaultValue(node, props.type, '' + props.defaultValue);
    }
    if (props.checked == null && props.defaultChecked != null) {
      node.defaultChecked = !!props.defaultChecked;
    }
  }
}

export function postMountWrapper(element: Element, props: Object) {
  var node = ((element: any): InputWithWrapperState);
  var hasUserInput = node.value !== '';
  var value = node._wrapperState.initialValue;

  if (value !== '' || props.hasOwnProperty('value')) {
    // Do not assign value if it is already set. This prevents user text input
    // from being lost during SSR hydration.
    if (!hasUserInput) {
      node.value = value;
    }

    // value must be assigned before defaultValue. This fixes an issue where the
    // visually displayed value of date inputs disappears on mobile Safari and Chrome:
    // https://github.com/facebook/react/issues/7233
    node.defaultValue = value;
  }

  // Normally, we'd just do `node.checked = node.checked` upon initial mount, less this bug
  // this is needed to work around a chrome bug where setting defaultChecked
  // will sometimes influence the value of checked (even after detachment).
  // Reference: https://bugs.chromium.org/p/chromium/issues/detail?id=608416
  // We need to temporarily unset name to avoid disrupting radio button groups.
  var name = node.name;
  if (name !== '') {
    node.name = '';
  }
  node.defaultChecked = !node.defaultChecked;
  node.defaultChecked = !node.defaultChecked;
  if (name !== '') {
    node.name = name;
  }
}

export function restoreControlledState(element: Element, props: Object) {
  var node = ((element: any): InputWithWrapperState);
  updateWrapper(node, props);
  updateNamedCousins(node, props);
}

function updateNamedCousins(rootNode, props) {
  var name = props.name;
  if (props.type === 'radio' && name != null) {
    var queryRoot: Element = rootNode;

    while (queryRoot.parentNode) {
      queryRoot = ((queryRoot.parentNode: any): Element);
    }

    // If `rootNode.form` was non-null, then we could try `form.elements`,
    // but that sometimes behaves strangely in IE8. We could also try using
    // `form.getElementsByName`, but that will only return direct children
    // and won't include inputs that use the HTML5 `form=` attribute. Since
    // the input might not even be in a form. It might not even be in the
    // document. Let's just use the local `querySelectorAll` to ensure we don't
    // miss anything.
    var group = queryRoot.querySelectorAll(
      'input[name=' + JSON.stringify('' + name) + '][type="radio"]',
    );

    for (var i = 0; i < group.length; i++) {
      var otherNode = ((group[i]: any): HTMLInputElement);
      if (otherNode === rootNode || otherNode.form !== rootNode.form) {
        continue;
      }
      // This will throw if radio buttons rendered by different copies of React
      // and the same name are rendered into the same form (same as #1939).
      // That's probably okay; we don't support it just as we don't support
      // mixing React radio buttons with non-React ones.
      var otherProps = getFiberCurrentPropsFromNode(otherNode);
      invariant(
        otherProps,
        'ReactDOMInput: Mixing React and non-React radio inputs with the ' +
          'same `name` is not supported.',
      );
      // If this is a controlled radio button group, forcing the input that
      // was previously checked to update will cause it to be come re-checked
      // as appropriate.
      updateWrapper(otherNode, otherProps);
    }
  }
}

// In Chrome, assigning defaultValue to certain input types triggers input validation.
// For number inputs, the display value loses trailing decimal points. For email inputs,
// Chrome raises "The specified value <x> is not a valid email address".
//
// Here we check to see if the defaultValue has actually changed, avoiding these problems
// when the user is inputting text
//
// https://github.com/facebook/react/issues/7253
function synchronizeDefaultValue(node: Element, type: ?string, value: string) {
  if (
    // Focused number inputs synchronize on blur. See ChangeEventPlugin.js
    (type !== 'number' || node.ownerDocument.activeElement !== node) &&
    node.defaultValue !== value
  ) {
    node.defaultValue = value;
  }
}
