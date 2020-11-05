import { registry_config } from "./registry";

const GLOBAL_CSS = `\
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;600;700&display=swap');

.p-block {
  margin: 2.5em 0;
}

.p-block.center {
  text-align: center;
}

.p-block.em1 {
  margin: 1em 0;
}

.p-block.grey {
  color: hsl(0, 0%, 55%);
}

.p-block.small {
  font-size: 12px;
}

p {
  font-family: 'Roboto', sans-serif;
}

h1 {
    font-family: 'Roboto', sans-serif;
    font-weight: 700;
    font-size: 2em;
    text-align: center;
}

.button1 {
    padding: 12px 24px;

    border: 0;
    border-radius: 3px;

    outline: none;

    user-select: none;
    cursor: pointer;

    color: hsl(228, 100%, 60%);
    font-family: "Roboto", sans-serif;
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 1px;
    text-decoration: none;

    background-color: rgba(23, 68, 255, 0.05);
}`;

export function email_verification(token: string): string {
    const registry_config_snapshot = registry_config.get();

    const instance_name = registry_config_snapshot["instance.display_name"].value as string || "";
    const instance_domain = registry_config_snapshot["instance.domain"].value as string;

    return `\
<head>
    <style>${ GLOBAL_CSS }</style>
</head>
<body>
    <h1>${ instance_name }</h1>

    <div class="p-block center">
        <p>Someone created an account using this email address. If it was you, please, click the button below to verify that this address belongs to you.</p>
    </div>

    <div class="p-block center">
        <a href="http://${ instance_domain }/System:UserSettings?email_token_action=verify_email&email_token=${ token }" class="button1">VERIFY EMAIL ADDRESS</a>
    </div>

    <div class="p-block center grey small">
    <p>The link will be valid for the next 2 hours.</p>
    </div>
</body>`;
}


export function email_change(token: string): string {
  const registry_config_snapshot = registry_config.get();

  const instance_name = registry_config_snapshot["instance.display_name"].value as string || "";
  const instance_domain = registry_config_snapshot["instance.domain"].value as string;

  return `\
<head>
  <style>${ GLOBAL_CSS }</style>
</head>
<body>
  <h1>${ instance_name }</h1>

  <div class="p-block center">
      <p>Someone (probably you) requested to change their emaill address to this one. If it was you, please, click the button below to verify this action.</p>
  </div>

  <div class="p-block center">
      <a href="http://${ instance_domain }/System:UserSettings?email_token_action=change_email&email_token=${ token }" class="button1">VERIFY NEW EMAIL ADDRESS</a>
  </div>

  <div class="p-block center grey small">
  <p>The link will be valid for the next 2 hours.</p>
  </div>
</body>`;
}