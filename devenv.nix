{
  pkgs,
  lib,
  config,
  inputs,
  ...
}:

{
  packages = [ pkgs.git ];

  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_24;
    pnpm = {
      enable = true;
    };
  };

  enterShell = ''
    export PNPM_HOME="${config.env.DEVENV_DOTFILE}/pnpm-global";
    export PATH="$PNPM_HOME/bin:$PATH";

    if ! command -v pi >/dev/null 2>&1; then
      echo "Installing pi dev agent (@earendil-works/pi-coding-agent)..."
      pnpm add -g --ignore-scripts @earendil-works/pi-coding-agent
    fi
  '';

}
