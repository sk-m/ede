// TODO look at rules again
module.exports = {
    "env": {
        "browser": true,
        "commonjs": true,
        "es6": true
    },
    "extends": "eslint:recommended",
    "globals": {
        "ede": "readonly",
        "ede_onready": "readonly",
        "Prism": "readonly",
    },
    "parserOptions": {
        "ecmaVersion": 2018
    },
    "rules": {
        "no-template-curly-in-string": "error",
        "no-invalid-this": "error",
        "no-return-assign": "error",
        "no-self-compare": "error",
        "no-throw-literal": "error",

        "max-len": ["warn", { "code": 140 }],
        "indent": ["warn", 4, { "MemberExpression": "off", "SwitchCase": 1 }],
        "quotes": ["warn", "double"],
        "no-extra-parens": "warn",
        "require-atomic-updates": "warn",
        "class-methods-use-this": "warn",
        "consistent-return": "warn",
        // "default-case-last": "warn",
        // "default-case": "warn",
        "default-param-last": "warn",
        "eqeqeq": "warn",
        "dot-notation": "warn",
        "no-else-return": "warn",
        "no-empty-function": "warn",
        "no-floating-decimal": "warn",
        "no-useless-return": "warn",
        "prefer-promise-reject-errors": "warn",
        "radix": "warn",
        "yoda": "warn",
        "no-shadow": "warn",
        "no-undef-init": "warn",
        "array-bracket-spacing": ["warn", "never"],
        "comma-dangle": ["error", "never"],
        "comma-spacing": ["error", { "before": false, "after": true }],
        "eol-last": ["warn", "always"],
        "no-lonely-if": "warn",
        "no-multi-assign": "error",
        "func-call-spacing": ["error", "never"],
        "no-nested-ternary": "warn",
        "no-trailing-spaces": "warn",
        "no-unneeded-ternary": "warn",
        "no-whitespace-before-property": "warn",
        "no-confusing-arrow": "warn",
        "arrow-spacing": ["error", { "before": true, "after": true }],
        "no-useless-computed-key": "warn",
        "prefer-arrow-callback": "warn",
        "prefer-const": "warn"
    }
};