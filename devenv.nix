{
  pkgs,
  lib,
  config,
  inputs,
  ...
}:

{
  # https://devenv.sh/basics/
  env.PATH = "${config.devenv.root}/node_modules/.bin:$PATH";

  # https://devenv.sh/packages/
  packages = [ pkgs.git ];

  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_24;
    pnpm = {
      enable = true;
    };
  };

}
