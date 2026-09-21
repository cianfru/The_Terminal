# AEON #14 — reconstruct it yourself

Generated 2026-09-21. Every line resolves to a transaction hash.

## A. Which wallet holds the NFT, and how it got there

Live `ownerOf(14)` on `0xc374a204334d4Edd4C6a62f0867C752d65E9579c` returns **0xc30fb77378d54dd5161bdaf28f99aaecd44cc7e4**

| # | date (UTC) | from | to | tx |
|---|---|---|---|---|
| 1 | 2023-11-16T01:46:23 | `0x0000000000000000000000000000000000000000` | `0xCE9a173965d13Dbf7b509C94F314695363acADA7` | https://etherscan.io/tx/0x35554b0c0982fc00d20a301d8fd20b72e5cb2c22affc4387e71c87028e9ae711 |
| 2 | 2025-12-20T19:23:23 | `0xCE9a173965d13Dbf7b509C94F314695363acADA7` | `0x640BfEf7bcDd64675F9EBc98B157f5386424DAC5` | https://etherscan.io/tx/0x7621bff6d4ffcedd64d64df783fa69f36aef068c2ee746c350a84868e4dbd0ff |
| 3 | 2026-01-08T00:57:35 | `0x640BfEf7bcDd64675F9EBc98B157f5386424DAC5` | `0xC30fB77378D54DD5161BDaF28f99aaEcd44cc7E4` | https://etherscan.io/tx/0x790ee288d17d30a175985108b59a850967182f53bf5383870394e0939a4bf98d |

Neither later holder has ever sent or received a single SPX. The trader is the MINTER, upstream of them.

## B. The cluster — every wallet, and the rule that linked it

Linked only on **drain-into-empty**: a wallet empties >=90% of its balance into one that held nothing before.

| wallet | role |
|---|---|
| `0xce9a173965d13dbf7b509c94f314695363acada7` | plain wallet |
| `0x5b403e9a31edbc845473e1fcfafb2ba0feb9ead6` | plain wallet |
| `0x9f7e2f5e0266e5d69189a570a129a07e044b28c1` | plain wallet |
| `0xc30fb77378d54dd5161bdaf28f99aaecd44cc7e4` | plain wallet |
| `0x640bfef7bcdd64675f9ebc98b157f5386424dac5` | plain wallet |
| `0x3542f155502840cc20b1255ad76054546717e89c` | plain wallet |

## C. Every SPX transfer OUT of the cluster — 40 transfers, 5,137,620 SPX

These are TRANSFERS, not sales. Sales are in section D.

| date | SPX | from | to | tx |
|---|---|---|---|---|
| 2023-09-04 | 245,000 | `0x5b403e9a31edbc845473e1fcfafb2ba0feb9ead6` | `0xf80378da69c496446da81f0791db8e976516b14b` | https://etherscan.io/tx/0xda40acd7d692b743d64e2996f3713dae9af51d6ebbcb60eebc5a039fb3550397 |
| 2023-09-04 | 69,420 | `0x5b403e9a31edbc845473e1fcfafb2ba0feb9ead6` | `0x853aea790d5e02ed10fe3ef1755d3e93204abea2` | https://etherscan.io/tx/0xf354292e83afde556029abe6e48c7ac0a30d887ec567feff0e1bfac18b49525a |
| 2023-09-04 | 69,420 | `0x5b403e9a31edbc845473e1fcfafb2ba0feb9ead6` | `0x6faab9c2aed45ae27f51a3f693cf095f40c9402f` | https://etherscan.io/tx/0x2daee30c9d96c6671e9ab55435fe3ca63be0cf3cbf3945e6b000fa4ff1aa2e42 |
| 2023-09-24 | 42,000 | `0x9f7e2f5e0266e5d69189a570a129a07e044b28c1` | `0x0b692a581fffc57771213aaf403366c300279962` | https://etherscan.io/tx/0x0f04781f09daa36b6c14eecd99fa5e18db0f1a35638979d0267eb9c1096810ee |
| 2023-09-24 | 42,690 | `0x9f7e2f5e0266e5d69189a570a129a07e044b28c1` | `0xf93c210f307bda64c310f32e73f2e70ff6942d24` | https://etherscan.io/tx/0x7e752b12992076a57dd51a1eeb9c2b7b871623768b2fea02c225999b63b29d5f |
| 2023-09-26 | 69,420 | `0x9f7e2f5e0266e5d69189a570a129a07e044b28c1` | `0x6d4a2cbfdb140b45cc1a8f60a4c680a0fad3b2d7` | https://etherscan.io/tx/0x700ae9181bfe7c60ba23ecdb3d3efbb5cb06069eb0e9c204e563432f280d4dbf |
| 2023-09-27 | 42,069 | `0x9f7e2f5e0266e5d69189a570a129a07e044b28c1` | `0xb51e6bc9baaf596b2b8f63f6ee0e579d599ab3d8` | https://etherscan.io/tx/0x5ce2ad5767d76bca183ce7bd22fc3d3e87c39c6155006c134333a095980c8c56 |
| 2023-09-28 | 42,069 | `0x9f7e2f5e0266e5d69189a570a129a07e044b28c1` | `0x0bea4dbbb144b533713ed61a55e6b86ce3b4668d` | https://etherscan.io/tx/0x2cf05cdb475b9495b6cd800ae2085b06abf41b2be48f516ee0913b87a2e51c34 |
| 2023-09-29 | 42,069 | `0x9f7e2f5e0266e5d69189a570a129a07e044b28c1` | `0x2f21bbec471f4bfb7e347d52846f7b881ac4c09f` | https://etherscan.io/tx/0x56f81922b341da51a0416dc363ebdc7fbd4f83fda7218c20875365734398b2e0 |
| 2023-09-29 | 25,000 | `0x9f7e2f5e0266e5d69189a570a129a07e044b28c1` | `0x88051fab6e80665a5939c9d7250cc6a33f1d1a5a` | https://etherscan.io/tx/0xefce47d05a99e536fbd76e0e8fe2d5067278e86dbe9ccce659ec8e376e51aa11 |
| 2023-09-30 | 42,069 | `0x9f7e2f5e0266e5d69189a570a129a07e044b28c1` | `0x367258ab0335e952ca573a4caf8da2f3ad7d2783` | https://etherscan.io/tx/0x5b81d9934b1f623214ba441790ff9d4df2df95cfef0c6343227eefb0b1feb93f |
| 2023-09-30 | 11,111 | `0x9f7e2f5e0266e5d69189a570a129a07e044b28c1` | `0x9adb98f5332a4e99c755cd0589bac2980d5caa51` | https://etherscan.io/tx/0xa9de979cd1ee50653578e87f7b56c121a0c47eff36c63fb0902b703e0a492b67 |
| 2023-10-03 | 69,420 | `0x9f7e2f5e0266e5d69189a570a129a07e044b28c1` | `0x0b10d1a2436295b40c8b0336e1dd4109a0607790` | https://etherscan.io/tx/0x33dcfad4b34e0ff5f2ec82fbc1d129d889c278165e15304226093ee8d777649a |
| 2023-11-04 | 6,730 | `0xce9a173965d13dbf7b509c94f314695363acada7` | `0x9c968da4e5fd7b6a4709b993cc21c8ef0eb26f6e` | https://etherscan.io/tx/0xeee6d9067d14a25fbca0d6297f3ce2216510f0496e6b0460ef05594c2915bfbd |
| 2023-11-20 | 10,268 | `0xce9a173965d13dbf7b509c94f314695363acada7` | `0x3c0e13b0ba8da318412ca819431ebb96eb4fac2e` | https://etherscan.io/tx/0x26b463e05eedc0d61954934cd36e28f877a8c1e65bf32b96b924e077c23d716e |
| 2023-11-30 | 182,963 | `0xce9a173965d13dbf7b509c94f314695363acada7` | `0x05ce5005ee8e7d3585d8f52197d96bee026dd0a6` | https://etherscan.io/tx/0xfe516f1352716f53bf3a88683e5d7a25edcada5dc81117d5434757d85712a102 |
| 2023-12-07 | 69,000 | `0xce9a173965d13dbf7b509c94f314695363acada7` | `0x5e4bee9ce3c96a51905bc0d2db5f802568df6703` | https://etherscan.io/tx/0x996c46fc2a74146ecc24902693d30e9a0ccfacad87b2af2dae63148925f1c031 |
| 2023-12-07 | 316,143 | `0xce9a173965d13dbf7b509c94f314695363acada7` | `0x9adb98f5332a4e99c755cd0589bac2980d5caa51` | https://etherscan.io/tx/0x5a09b94044202a3d3ae67e12a454556bfd920218b2dc17478e616eb0975bdb83 |
| 2023-12-09 | 111,111 | `0xce9a173965d13dbf7b509c94f314695363acada7` | `0x9adb98f5332a4e99c755cd0589bac2980d5caa51` | https://etherscan.io/tx/0x1b6d9eeedbf090526459ccb8bd0f9fe2c35249435b5a0bfc2f7b76d76e707487 |
| 2023-12-20 | 18,888 | `0xce9a173965d13dbf7b509c94f314695363acada7` | `0x886a9ab7b89393a4ff568af97f8cb39928c62252` | https://etherscan.io/tx/0xd35d8e2939b43577a7d1465245fc78b7b6f010de40492f8ab690ebefaca2cf65 |
| 2023-12-20 | 18,888 | `0xce9a173965d13dbf7b509c94f314695363acada7` | `0xfa2632a4b0a90ec5adf9f79ab8c0e43fb2febc76` | https://etherscan.io/tx/0x643be66dbd58596cc7a11c0d38f4441bcd535f8199e48a9ef9aeecb60751d27c |
| 2023-12-20 | 18,888 | `0xce9a173965d13dbf7b509c94f314695363acada7` | `0x720723842a049c8971624c1363b1e1ce312694ac` | https://etherscan.io/tx/0x7e03a5b4dc231706ff57cffbe65f2f7741e80e68d1707216f84d3fc6c80f2445 |
| 2023-12-20 | 18,888 | `0xce9a173965d13dbf7b509c94f314695363acada7` | `0xdf21e9d544ca93df164a44decee42c28a7e0476e` | https://etherscan.io/tx/0x875e0e632979fb635a4131eb858eae707161d0dbaafaf1bcea10a0660dc6d1ea |
| 2023-12-20 | 19,999 | `0xce9a173965d13dbf7b509c94f314695363acada7` | `0xf8dc8ef108d9db3d2cc20ba21e9b82f127ccb13d` | https://etherscan.io/tx/0x0a1d34293698ed8bf27992a65a6e0b7f7aebb71417114bfe22984964356b6b95 |
| 2023-12-20 | 17,777 | `0xce9a173965d13dbf7b509c94f314695363acada7` | `0x7d33d9d1d3ce2e65a9fc0795167e63c227e26b08` | https://etherscan.io/tx/0x672cf4fc0832cfdcf76be36775b576459e273fbb8418e8bee87f3fcfcb962f3c |
| 2023-12-20 | 17,777 | `0xce9a173965d13dbf7b509c94f314695363acada7` | `0xdf0f13e0cad2776efb2f611399fd6e61be53c008` | https://etherscan.io/tx/0x4ea32a0fb846ae4f7dbed89198cf4af4a212ead9a1366c3f1ca4688308e8d290 |
| 2023-12-20 | 111,111 | `0xce9a173965d13dbf7b509c94f314695363acada7` | `0x10bd995c7ec4bfa2723982191ed3078c7dc23b27` | https://etherscan.io/tx/0x4771e0e233cdae20a78386dddf7dc9706f64603bce7783b37eb704270685d7fb |
| 2023-12-20 | 17,777 | `0xce9a173965d13dbf7b509c94f314695363acada7` | `0x9260ae742f44b7a2e9472f5c299aa0432b3502fa` | https://etherscan.io/tx/0x5428b59278fcd96b327838f7cd98ef74b4fc1b060bd7ea02e87dd0ca55131976 |
| 2023-12-20 | 6,900 | `0xce9a173965d13dbf7b509c94f314695363acada7` | `0x3ee18b2214aff97000d974cf647e7c347e8fa585` | https://etherscan.io/tx/0xb05d382f8afae5e3e5ba09082f9524b1a5d781cb2c5e529c0a81d7d4ceab9404 |
| 2023-12-20 | 6,900 | `0xce9a173965d13dbf7b509c94f314695363acada7` | `0x3ee18b2214aff97000d974cf647e7c347e8fa585` | https://etherscan.io/tx/0xf5a8d01f8ee808110619bb1f3350c85e58632404e100beab49ec53164528415a |
| 2023-12-21 | 15,555 | `0xce9a173965d13dbf7b509c94f314695363acada7` | `0xfa0b5276f665243c2fa106ed378fce87bfd82323` | https://etherscan.io/tx/0xedc3c07c68771074a2a9f2a0711672abfd2e91a53031a164b0d0afab007ac4e2 |
| 2023-12-21 | 14,444 | `0xce9a173965d13dbf7b509c94f314695363acada7` | `0xe57d64bba550002744ef89aa49d15de5d80645e6` | https://etherscan.io/tx/0xfa74bf6db2f089970e85ab349d1d2ac9844a807b65df890aec228960e3ec7ac1 |
| 2023-12-27 | 6,900 | `0xce9a173965d13dbf7b509c94f314695363acada7` | `0x287e2c76aab4720786076c3deedd7dd386092050` | https://etherscan.io/tx/0x2c913cf9dc0bfb6efbe6f4af0edb1ece162a4e473baaa7c71ce06d1fee0eee46 |
| 2023-12-30 | 8,957 | `0xce9a173965d13dbf7b509c94f314695363acada7` | `0x3c0e13b0ba8da318412ca819431ebb96eb4fac2e` | https://etherscan.io/tx/0x484e5274922da33e7e8057cccfdafbfc7ed9a2bf0c9d7337602c8201c28b3a47 |
| 2024-02-18 | 666,666 | `0xce9a173965d13dbf7b509c94f314695363acada7` | `0x6615dfaeadf06208849494ca68168f6dbfea748a` | https://etherscan.io/tx/0x79389348fd2ccf283063d0050f2535ca7638614b34704b8c40d20adcb1e45c66 |
| 2024-04-24 | 77,777 | `0xce9a173965d13dbf7b509c94f314695363acada7` | `0xe387227ccfba58f870cabf1e052c45ec3ae1ff47` | https://etherscan.io/tx/0xf25f8a81bd904db731ccb54ebc9495b960656f1f4dbba2737767de5710f9ff2a |
| 2024-04-24 | 99,999 | `0xce9a173965d13dbf7b509c94f314695363acada7` | `0xae3f656bd26fbce9c364394951dfafb85c81ea51` | https://etherscan.io/tx/0xd5c541f47d9ade92bcf6839212f09065226f5a6e983de7f55242c27be4d1feb3 |
| 2024-04-24 | 99,999 | `0xce9a173965d13dbf7b509c94f314695363acada7` | `0x42db594c0d6c94b9efce40e85b0c4e8bbdc88265` | https://etherscan.io/tx/0x361e565173df0d47f70a37202ad47e0368a1f9ed899ec4c0cd39479d3d3ac36c |
| 2024-05-17 | 365,558 | `0xce9a173965d13dbf7b509c94f314695363acada7` | `0x729ef2639b77353528905f4005412d82d6777cd1` | https://etherscan.io/tx/0xac0295559bf6bb07a5e857c54233d90fd467b0de22e183d267272fe2b4c35166 |
| 2024-07-08 | 2,000,000 | `0xce9a173965d13dbf7b509c94f314695363acada7` | `0xc41e7f2230200c7d1bb96a70343e3e0461714464` | https://etherscan.io/tx/0xb783725f2e7da2a61878df01ea7fefca2ffba339cbca1252313b4eea8397292e |

## D. Every SPX the cluster SOLD on the market — 11 sales, 2,249,039 SPX

| date | SPX | venue | tx |
|---|---|---|---|
| 2023-09-04 | 129,662 | `0x52c77b0cb827afbad022e6d6caf2c44452edbc39` | https://etherscan.io/tx/0xf1586b759e70d72a706a11aac724451bb1729955284039bb6aa67ba11353939d |
| 2023-09-04 | 442,908 | `0x00ed26e794b949e18b142f9108429b74ce08ac99` | https://etherscan.io/tx/0x81092ffcee4815b122613968ba0127b7d6e224addd0c0cd1076bd3e0ea4b7ea7 |
| 2023-09-18 | 611,390 | `0x52c77b0cb827afbad022e6d6caf2c44452edbc39` | https://etherscan.io/tx/0x80a8bf94bbd28af414790d8c510e61db9730958b7308695c8427be9a2adf0b8c |
| 2023-09-25 | 225,406 | `0x52c77b0cb827afbad022e6d6caf2c44452edbc39` | https://etherscan.io/tx/0xf9a8db442515b0da3ebab7b44757ffbf829d6833f68f66c98a0797e0af1a623e |
| 2023-10-11 | 161,892 | `0x00ed26e794b949e18b142f9108429b74ce08ac99` | https://etherscan.io/tx/0xb29e60f050515a73118e2cd31ddbc567189887a82eee0725fba3d0e83b883530 |
| 2023-10-11 | 160,351 | `0x52c77b0cb827afbad022e6d6caf2c44452edbc39` | https://etherscan.io/tx/0xce38f415958f083c45d304263febf49e6be41f4888b95fb82a90d1439acf2b26 |
| 2023-12-09 | 14,857 | `0x52c77b0cb827afbad022e6d6caf2c44452edbc39` | https://etherscan.io/tx/0x20dbca7f111e543c458c5f454b3b55b595df0e426796fec1e6c4ebe42d63a8e5 |
| 2023-12-20 | 29,240 | `0x00ed26e794b949e18b142f9108429b74ce08ac99` | https://etherscan.io/tx/0xe44906039fbe2c3d2ea0369081fe36abf57855ebb4d90934a4d2a51aa28fd690 |
| 2024-02-15 | 40,000 | `0x52c77b0cb827afbad022e6d6caf2c44452edbc39` | https://etherscan.io/tx/0x06052b051d73ad2224141848ebb7ab96506beb62289c719cb0fac8f479d9bbe2 |
| 2024-03-02 | 33,334 | `0x52c77b0cb827afbad022e6d6caf2c44452edbc39` | https://etherscan.io/tx/0x0aee836e39e7b8ce198928d761a6683227e51f3fa6cefb7ee07159444d19bcba |
| 2024-06-04 | 400,000 | `0x9008d19f58aabd9ed0d60971565aa8510560ab41` | https://etherscan.io/tx/0xb79373ca1cb1d97e5e964ee59e53577754cfe503cf154358a160a58c3f68f2b1 |

## E. What each destination did with it

### On `0xc41e7f22` — the 2,000,000, and why the trail stops

It received **2,000,000 SPX from this cluster on 2024-07-08** and **1,630,000 from an unrelated
wallet the same day**. Before that, on **2024-06-12**, it was funded with **7.34643 ETH direct from
ChangeNow's hot wallet** (`0x077D360f11D220E4d5D831430c81C26c9be7C4A4`, tagged in our own
EXCLUDE_LABELS) — roughly $25,000 at the time.

**What that does and does not mean.** A swap service does not link its inputs to its outputs
on-chain, so you cannot walk backwards through it the way you can through a wallet. That is a
chain-of-custody limit, nothing more. ChangeNow is a registered instant-swap business with an AML
policy and KYC above thresholds — it is **not** a mixer, and **not** comparable to Tornado Cash,
which is a non-custodial mixing contract under OFAC sanction. Ordinary people use ChangeNow to swap
without opening an exchange account; receiving from it is unremarkable on its own.

What makes this address unattributable is the combination, not any single fact: two unrelated
funding sources on one day, and a setup funded through a service whose flows cannot be reversed.
It is still holding 384,955 SPX and has been selling into Uniswap as recently as 2026.


⚠ A fungible token cannot be tainted. Once SPX lands in a wallet holding its own, nothing on-chain says which coins later left. The `our share` column is what fraction of everything that address EVER received came from this cluster — where it reads low, its behaviour is mostly someone else's money.

| destination | got from us | our share of its inflow | what it did next | holds now |
|---|---|---|---|---|
| `0xc41e7f2230200c7d1bb96a70343e3e0461714464` | 2,000,000 | 36% | passed onward, sold | 384,955 |
| `0x6615dfaeadf06208849494ca68168f6dbfea748a` | 666,666 | 100% | passed onward, CEX:MEV bot, sold | 0 |
| `0x9adb98f5332a4e99c755cd0589bac2980d5caa51` | 438,365 | 31% | sold | 0 |
| `0x729ef2639b77353528905f4005412d82d6777cd1` | 365,558 | 86% | passed onward | 0 |
| `0xf80378da69c496446da81f0791db8e976516b14b` | 245,000 | 4% | sold, passed onward | 0 |
| `0x05ce5005ee8e7d3585d8f52197d96bee026dd0a6` | 182,963 | 100% | sold | 0 |
| `0x10bd995c7ec4bfa2723982191ed3078c7dc23b27` | 111,111 | 100% | sold | 0 |
| `0xae3f656bd26fbce9c364394951dfafb85c81ea51` | 99,999 | 2% | sold, passed onward | 0 |
| `0x42db594c0d6c94b9efce40e85b0c4e8bbdc88265` | 99,999 | 100% | passed onward | 0 |
| `0xe387227ccfba58f870cabf1e052c45ec3ae1ff47` | 77,777 | 18% | sold | 0 |
| `0x853aea790d5e02ed10fe3ef1755d3e93204abea2` | 69,420 | 1% | passed onward, sold | 0 |
| `0x6faab9c2aed45ae27f51a3f693cf095f40c9402f` | 69,420 | 17% | passed onward, sold | 0 |
| `0x6d4a2cbfdb140b45cc1a8f60a4c680a0fad3b2d7` | 69,420 | 100% | passed onward | 0 |
| `0x0b10d1a2436295b40c8b0336e1dd4109a0607790` | 69,420 | 20% | sold | 0 |
| `0x5e4bee9ce3c96a51905bc0d2db5f802568df6703` | 69,000 | 100% | sold | 0 |
| `0xf93c210f307bda64c310f32e73f2e70ff6942d24` | 42,690 | 1% | passed onward, sold | 0 |
| `0xb51e6bc9baaf596b2b8f63f6ee0e579d599ab3d8` | 42,069 | 17% | sold | 0 |
| `0x0bea4dbbb144b533713ed61a55e6b86ce3b4668d` | 42,069 | 1% | passed onward, sold | 0 |
| `0x2f21bbec471f4bfb7e347d52846f7b881ac4c09f` | 42,069 | 22% | passed onward, sold | 0 |
| `0x367258ab0335e952ca573a4caf8da2f3ad7d2783` | 42,069 | 4% | sold, passed onward | 1 |
| `0x0b692a581fffc57771213aaf403366c300279962` | 42,000 | 100% | passed onward, sold | 0 |
| `0x88051fab6e80665a5939c9d7250cc6a33f1d1a5a` | 25,000 | 1% | sold, passed onward | 0 |
| `0xf8dc8ef108d9db3d2cc20ba21e9b82f127ccb13d` | 19,999 | 100% | sold | 0 |
| `0x3c0e13b0ba8da318412ca819431ebb96eb4fac2e` | 19,225 | 24% | sold, passed onward | 0 |
| `0x886a9ab7b89393a4ff568af97f8cb39928c62252` | 18,888 | 100% | sold | 0 |
| `0xfa2632a4b0a90ec5adf9f79ab8c0e43fb2febc76` | 18,888 | 100% | passed onward | 0 |
| `0x720723842a049c8971624c1363b1e1ce312694ac` | 18,888 | 0% | sold | 0 |
| `0xdf21e9d544ca93df164a44decee42c28a7e0476e` | 18,888 | 86% | passed onward | 0 |
| `0x7d33d9d1d3ce2e65a9fc0795167e63c227e26b08` | 17,777 | 100% | sold | 0 |
| `0xdf0f13e0cad2776efb2f611399fd6e61be53c008` | 17,777 | 100% | sold | 0 |
| `0x9260ae742f44b7a2e9472f5c299aa0432b3502fa` | 17,777 | 100% | sold | 0 |
| `0xfa0b5276f665243c2fa106ed378fce87bfd82323` | 15,555 | 23% | passed onward, sold | 0 |
| `0xe57d64bba550002744ef89aa49d15de5d80645e6` | 14,444 | 100% | passed onward | 0 |
| `0x3ee18b2214aff97000d974cf647e7c347e8fa585` | 13,800 | — | **Wormhole bridge** (infrastructure, not a wallet) | — |
| `0x287e2c76aab4720786076c3deedd7dd386092050` | 6,900 | 100% | passed onward | 0 |
| `0x9c968da4e5fd7b6a4709b993cc21c8ef0eb26f6e` | 6,730 | 0% | sold, passed onward | 8,001 |