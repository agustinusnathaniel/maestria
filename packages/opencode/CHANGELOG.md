# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.2.2](https://github.com/agustinusnathaniel/maestria/compare/v0.2.1...v0.2.2) (2026-06-12)

### Features

- **docs:** add Astro Starlight documentation site for @maestria/opencode ([06a21ac](https://github.com/agustinusnathaniel/maestria/commit/06a21ac7b95ab97bcf5773bd43081fabe1bf1be6))

### Bug Fixes

- **opencode:** correct source repos for 10 skills per my-base doc ([d2e0671](https://github.com/agustinusnathaniel/maestria/commit/d2e0671b7fd8816684bdb960b57defda1f074784))
- **opencode:** restore commit discipline, counter builder dispatch bias ([29df280](https://github.com/agustinusnathaniel/maestria/commit/29df28071b4ca996cf65b1050de7f2c69b341c2f)), closes [#3](https://github.com/agustinusnathaniel/maestria/issues/3) [#7](https://github.com/agustinusnathaniel/maestria/issues/7) [#8](https://github.com/agustinusnathaniel/maestria/issues/8) [#1](https://github.com/agustinusnathaniel/maestria/issues/1)
- **opencode:** stop injecting rules into subagent prompts ([9dfb79c](https://github.com/agustinusnathaniel/maestria/commit/9dfb79cd005629617b900d7be2b8dab42ea3e48c))
- **orchestrator:** unstick webfetch by skipping approval + preferring local tools ([23278a0](https://github.com/agustinusnathaniel/maestria/commit/23278a03667909af740648af888377dc0ce8c31f)), closes [#9](https://github.com/agustinusnathaniel/maestria/issues/9)

## [0.2.1](https://github.com/agustinusnathaniel/maestria/compare/v0.2.0...v0.2.1) (2026-06-12)

### Bug Fixes

- force orchestrator delegation via permissions, inject specialist table into global rules ([74fcecd](https://github.com/agustinusnathaniel/maestria/commit/74fcecd20ec427da7accb857df2c6bb0b444b1f8))

## 0.2.0 (2026-06-12)

### Features

- add adventurer subagent, fix orchestrator delegation and skill patterns ([4306993](https://github.com/agustinusnathaniel/maestria/commit/4306993803b2f78f09bde009d1d164ddcd28b84e))
- **opencode:** add @maestria/opencode plugin with 7 agents and rules injection ([21138d2](https://github.com/agustinusnathaniel/maestria/commit/21138d29911604035cfa7e589618caac2f92bcc5))
- **opencode:** add agent cross-references and skill discovery guidance ([b49e3e9](https://github.com/agustinusnathaniel/maestria/commit/b49e3e9427b02d0781aa15dd1a8dfc60e5140abc))
- **opencode:** add categorized skill catalog to orchestrator ([8883b11](https://github.com/agustinusnathaniel/maestria/commit/8883b11010dabb61972b353f689a7097bb8e591b))
- **opencode:** add Conventional Comments labels to reviewer output ([3578490](https://github.com/agustinusnathaniel/maestria/commit/357849075247b17e55dcb140af834554751894cb))
- **opencode:** add domain-specific skill lists to all subagents ([0f10b74](https://github.com/agustinusnathaniel/maestria/commit/0f10b74ca6d7955fd0b49c4276723ea47c646971))
- **opencode:** add opensrc pattern to global rules ([47962e9](https://github.com/agustinusnathaniel/maestria/commit/47962e9b4229e8c01ecde26fe621dbb73c41ff0d))
- **opencode:** enrich skill lists across all agents ([afb9400](https://github.com/agustinusnathaniel/maestria/commit/afb9400649918762631816e880bb8c0c6d641d15))
- **opencode:** final enrichment pass on agent skill lists ([e677425](https://github.com/agustinusnathaniel/maestria/commit/e67742538957bbd91ad3b8bc4990324c9e02041b))

### Bug Fixes

- **opencode:** add commit/push discipline rule ([e44aea3](https://github.com/agustinusnathaniel/maestria/commit/e44aea32540590b03bb59f4a5632815bf031dc6c))
