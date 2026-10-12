# VENDORED: harness de medicao (bench)

Copiado **verbatim** do repositorio upstream designcourt @ `d568871`, em 2026-10-12.
Licenca: MIT (mesma do repositorio upstream).

O corpus tem 49 arquivos: 48 paginas rotuladas (1 clean, 9 realslop, 38 synth)
mais `bench/corpus/labeled.jsonl`. Total de arquivos em `bench/corpus/`: 49.

`bench/lib/adapters.mjs` e `bench/run-lane-a.mjs` NAO vem do upstream: sao deste repo.
`bench/lib/metrics.mjs` e `bench/build-corpus.mjs` vieram sem alteracao.

## Arquivos e sha256

| arquivo | sha256 |
|---|---|
| `bench/lib/metrics.mjs` | `dc2767f0c7d9222568221d914a4ac715729af34ab7607eba6911899c852af599` |
| `bench/build-corpus.mjs` | `ddf1259df11268be574ba77fa0c44b38052752887523828b3266b99b34e259e0` |
| `bench/corpus/clean/base.html` | `6ef41065213640f279b73fcbf29c026058aefdd01690b5ad0b27c346ebbb1b2b` |
| `bench/corpus/labeled.jsonl` | `2a89573272b668f28ab8174a98fc9cb74e7bfa950eaec63d08184b5ce5c03c60` |
| `bench/corpus/realslop/agency-portfolio-zigzag.html` | `93befe75d808faffe97ce4ff5352669b69c37f2b3f88179ff07cfc610e20a6fa` |
| `bench/corpus/realslop/ai-landing-classic.html` | `abd3fb01f5aeb55939183b68312097633ae1ab90299886726b895b9c4643a255` |
| `bench/corpus/realslop/bento-crypto-launch.html` | `dcc0068fc62416ef49461a63176d2aa71b6bced02474b07c414e5bb30932f7f0` |
| `bench/corpus/realslop/dashboard-shell-slides.html` | `043b6136b6a5fb29203ef03352c9faa2db8e604d7a1ae8f9bb9d3aaaf9ce68f3` |
| `bench/corpus/realslop/escape-regression.html` | `8794c6cf0d66f62e21bc0901bdef1ab911367d7a86249048b6dcc484fdfb90ef` |
| `bench/corpus/realslop/marquee-event-site.html` | `25a6f7a620095e18ee3e790fad41847a58c3f88a86c5cb7584628df02db642ab` |
| `bench/corpus/realslop/onboarding-contrast-fail.html` | `7e30b819099030237b756fa9c17ab2ca93a344ff3949a8fdd312b8c556f49e64` |
| `bench/corpus/realslop/tiers-three-cards.html` | `91204cda348a50800ff46e5e8dff80003d67953fb1bb8df2c68b42c85376dc39` |
| `bench/corpus/realslop/warm-premium-studio.html` | `5ca99fd875353cc3d921ee92700c404b852e14de4748c145d82c23238b5cdd19` |
| `bench/corpus/synth/bento-empty-cell.html` | `d6defee3c8b2422ae02fe56b43711acd5a0d73a063d1d0799578672ffacf0cf7` |
| `bench/corpus/synth/contrast-aa.html` | `ad6e0b676a31ec02d04754913e949afca5e05f9a687f82c55f0b63ab98bb06e0` |
| `bench/corpus/synth/decorative-chrome.html` | `dbd363805b590128c19d0b2395a33fdc0b283b8de5b2af389c9bd9d288e8a1e5` |
| `bench/corpus/synth/duplicate-cta-intent.html` | `5857122a29ac2bbb8abbe6f4166d2c7dcd1a444eba41005192ef15bebd9ac94e` |
| `bench/corpus/synth/em-dash.html` | `776b76f0a312f30f4c57fa695d26eefb94015e4b050855e838d065b5e03ff73c` |
| `bench/corpus/synth/emoji-as-icon.html` | `948478d13a56754e07342955308ce9d46c7efa71770fe7bb36abee6810f059cd` |
| `bench/corpus/synth/eyebrow-density.html` | `0726f8fb483c2b4c136cbe14aec2f85ddc44ba7d540a8ba2789e5d0979cb0d92` |
| `bench/corpus/synth/fake-credits.html` | `bf53ec217f7d71d1c88c477651fb0a66f2881025ee2b583036cbc0a269697adf` |
| `bench/corpus/synth/fake-precise-numbers.html` | `1155754a9767fc813148a439b59c04cba365814acc6bd51210e27e2ef34e4ce9` |
| `bench/corpus/synth/fake-screenshot.html` | `056a97443513e80183f0b195667e6576e663f7570e8ed0f2ad9a92c8789be1b2` |
| `bench/corpus/synth/filler-verbs.html` | `974c4a040948f01b6d1ed01a35580b6072e3c0ce004c4143029b9cfc6bb0ef0b` |
| `bench/corpus/synth/generic-names.html` | `4d6927b060634cef45a38da47145a351d896f71fc9b938b720d90c3cbe62f231` |
| `bench/corpus/synth/h-screen.html` | `21dd597b3d8183953cbf1fbf922e59e712aa6377530ed8aab95ae3befd9c2d18` |
| `bench/corpus/synth/hardcoded-hex.html` | `146108a499bd9249881f5840da3a680f18c3a4bf2bdc2614a307d780aab1446a` |
| `bench/corpus/synth/hero-discipline.html` | `78ef9c851547d3812c39e467d1863d7fcb6f70414628a58aab58ec19ecc3437f` |
| `bench/corpus/synth/inter-default.html` | `30205124fe9f1d2bfefb4b417609226693c67d87e6afc47038c9c91a23665c2c` |
| `bench/corpus/synth/low-layout-diversity.html` | `14bf971545fd175bb92753dd24776ecc57b37e32f7c67bd5ea5a759ed1cd71a7` |
| `bench/corpus/synth/mixed-icon-family.html` | `21659b1edaa76a67daae0ae5b7ee51138acac7f32d57f1d16f2b97b6a4ab5808` |
| `bench/corpus/synth/mixed-language.html` | `fce57dc33bae5fbe21b4900ec865f21d6befec1a48e82fa7456d64c6a503be90` |
| `bench/corpus/synth/mixed-radii.html` | `ebf08c3a4bd52af3ea2b3a245e92eb9e0c2538481fa4502369dc0dc86f7567ee` |
| `bench/corpus/synth/multi-accent.html` | `3c80d3d202f9b9237169eba1ecd89373cd4981e449789451050a489ccfc90cf9` |
| `bench/corpus/synth/multi-marquee.html` | `67b3df06e6673b261123777b12e1ca575f77a1371387da31bd131d5bb3f2f8dc` |
| `bench/corpus/synth/nav-too-tall.html` | `5967d9b6e22a3301951c3aa277c1625167c398df2d588bc7d15497a41ef306f2` |
| `bench/corpus/synth/neon-glow.html` | `5f86139e8b6e98f9d2abf4acfb2907759e33096e8c9079ea65f979273e965eeb` |
| `bench/corpus/synth/numbered-eyebrow.html` | `f19fe083c259ed16a0382a6ebf0dd96835e56e28ff1d3a420fc114ec32ea9df9` |
| `bench/corpus/synth/placeholder-as-label.html` | `ba6701e85e7ddf421dcb496e1013f878fb2cc273a5ce8f93644bdfa81d5a3587` |
| `bench/corpus/synth/premium-consumer-palette.html` | `e1458a0faaa205442054a8a9e35ca564fa3bff140da03bd96463f7e58621e56f` |
| `bench/corpus/synth/property-animation.html` | `9bf40bec3f712084e366bf6515534895d4a4524f55e5d4e56fd1b6397390df77` |
| `bench/corpus/synth/purple-gradient.html` | `e722be8a7827030164ceed59c1da6b07799665e6c14637bf657ffd9f3d47b47c` |
| `bench/corpus/synth/reduced-motion-missing.html` | `40496a5263edc7a3580fa5e880b699cabc274f1dd2dde2b7de66dd7963516576` |
| `bench/corpus/synth/repeated-zigzag.html` | `29b0b96154fcc6c08f049e09168afc529f147f63536dbd8d5b7d9f22eb85a30b` |
| `bench/corpus/synth/scroll-cues.html` | `1c6d0a5378d85991646265964336316958503722d24a075a03b68998228f7008` |
| `bench/corpus/synth/scroll-listener-animation.html` | `8c7099c38855388773b7a4bcc8e26a6fa28ef8033560aff79e948af21ba50fc9` |
| `bench/corpus/synth/split-header.html` | `dac63dbefb3fd4fd681b86e545b35d0b3ed31c8cf7a04fdfe7f0c6d4ec611dc2` |
| `bench/corpus/synth/subtext-length.html` | `be5843f09e8ef5e0311178a666144c3047704e95770c7a06bd317684cd3dc7ed` |
| `bench/corpus/synth/text-logo-wall.html` | `08666f36050120e8c4c1f876c10776ce8d30b842a29f5fce85338a093cc12fa9` |
| `bench/corpus/synth/three-equal-cards.html` | `4ba3f96d6833c9748a898dc9c35a8c706088d154ff36ec36962e08c1d57789bc` |
| `bench/corpus/synth/version-footer.html` | `4363c531421ef1e922052c5d9dc71738992e1b4734c7acf64b542ad4eccf5303` |
