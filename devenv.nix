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
    export PATH="${config.env.DEVENV_DOTFILE}/pnpm-global/bin:$PATH";

    if ! command -v pi >/dev/null 2>&1; then
      echo "Installing pi dev agent (@earendil-works/pi-coding-agent@0.86.1)..."
      PNPM_HOME="${config.env.DEVENV_DOTFILE}/pnpm-global" \
        pnpm add --global @earendil-works/pi-coding-agent@0.86.1
    fi
  '';

}
