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
    export PATH=".devenv/pnpm-global/bin:$PATH"
  '';

}
