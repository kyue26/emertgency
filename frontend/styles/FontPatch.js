import { Text, TextInput } from "react-native";

export function applyGlobalFont() {
  const defaultFont = { fontFamily: "Poppins_400Regular" };

  // patch text
  const oldTextRender = Text.render;
  Text.render = function (...args) {
    const origin = oldTextRender.call(this, ...args);
    const style = origin.props.style || {};

    return {
      ...origin,
      props: {
        ...origin.props,
        style: [defaultFont, style],
      },
    };
  };

  // patch textinput
  const oldInputRender = TextInput.render;
  TextInput.render = function (...args) {
    const origin = oldInputRender.call(this, ...args);
    const style = origin.props.style || {};

    return {
      ...origin,
      props: {
        ...origin.props,
        style: [defaultFont, style],
      },
    };
  };
}
