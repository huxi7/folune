/**
 * [INPUT]: 依赖 Figma 19:2 各 Section 的原始导出素材与静态文案
 * [OUTPUT]: 对外提供第一阶段视觉基线的素材索引、代码行与扩展卡片数据
 * [POS]: widgets 的参考内容数据；只用于对照基线，第二阶段以真实产品内容替换
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export const referenceAssets: Record<string, string> = {
  "19-2147/imgFrame": "/landing-reference/19-2147-imgFrame.svg",
  "19-2147/imgFrame1": "/landing-reference/19-2147-imgFrame1.svg",
  "19-2147/imgFrame2": "/landing-reference/19-2147-imgFrame2.svg",
  "19-956/imgFrame": "/landing-reference/19-956-imgFrame.svg",
  "19-956/imgFrame1": "/landing-reference/19-956-imgFrame1.svg",
  "19-956/imgFrame2": "/landing-reference/19-956-imgFrame2.svg",
  "19-956/imgFrame3": "/landing-reference/19-956-imgFrame3.svg",
  "19-956/imgFrame4": "/landing-reference/19-956-imgFrame4.svg",
  "19-956/imgFrame5": "/landing-reference/19-956-imgFrame5.svg",
  "19-956/imgFrame6": "/landing-reference/19-956-imgFrame6.svg",
  "19-956/imgFrame7": "/landing-reference/19-956-imgFrame7.svg",
  "19-956/imgFrame8": "/landing-reference/19-956-imgFrame8.svg",
  "19-956/imgFrame9": "/landing-reference/19-956-imgFrame9.svg",
  "19-956/imgFrame10": "/landing-reference/19-956-imgFrame10.svg",
  "19-2757/imgImage": "/landing-reference/19-2757-imgImage.png",
  "19-2760/imgKazatsuyu": "/landing-reference/19-2760-imgKazatsuyu.png",
  "19-2760/imgHalavicH": "/landing-reference/19-2760-imgHalavicH.png",
  "19-2760/imgLnay": "/landing-reference/19-2760-imgLnay.png",
  "19-2760/imgOzacod": "/landing-reference/19-2760-imgOzacod.png",
  "19-2760/img5Brian": "/landing-reference/19-2760-img5Brian.png",
  "19-2760/imgJvmncs": "/landing-reference/19-2760-imgJvmncs.png",
  "19-2760/imgSomeone13574": "/landing-reference/19-2760-imgSomeone13574.png",
  "19-2760/imgGko": "/landing-reference/19-2760-imgGko.png",
  "19-2760/imgMartinYe1234": "/landing-reference/19-2760-imgMartinYe1234.png",
  "19-2760/imgZed": "/landing-reference/19-2760-imgZed.png",
  "19-2760/imgFindrakecil": "/landing-reference/19-2760-imgFindrakecil.png",
  "19-2760/img5Herlocked": "/landing-reference/19-2760-img5Herlocked.png",
  "19-2760/imgVitallium": "/landing-reference/19-2760-imgVitallium.png",
  "19-2760/imgOsyvokon": "/landing-reference/19-2760-imgOsyvokon.png",
  "19-2760/imgWeetHet": "/landing-reference/19-2760-imgWeetHet.png",
  "19-2760/imgAnthonyEid": "/landing-reference/19-2760-imgAnthonyEid.png",
  "19-2760/imgSourcefrog": "/landing-reference/19-2760-imgSourcefrog.png",
  "19-2760/imgMarius851000": "/landing-reference/19-2760-imgMarius851000.png",
  "19-2760/imgIamnbutler": "/landing-reference/19-2760-imgIamnbutler.png",
  "19-2760/imgAfgomez": "/landing-reference/19-2760-imgAfgomez.png",
  "19-2760/imgFdncred": "/landing-reference/19-2760-imgFdncred.png",
  "19-2760/imgBeIng": "/landing-reference/19-2760-imgBeIng.png",
  "19-2760/imgBcomnes": "/landing-reference/19-2760-imgBcomnes.png",
  "19-2760/imgAlygin": "/landing-reference/19-2760-imgAlygin.png",
  "19-2760/imgFloppyDisco": "/landing-reference/19-2760-imgFloppyDisco.png",
  "19-2760/imgForLoveOfCats": "/landing-reference/19-2760-imgForLoveOfCats.png",
  "19-2760/imgJosephTLyons": "/landing-reference/19-2760-imgJosephTLyons.png",
  "19-2760/imgAkbxr": "/landing-reference/19-2760-imgAkbxr.png",
  "19-2760/imgOmChillure": "/landing-reference/19-2760-imgOmChillure.png",
  "19-2760/imgOgnevny": "/landing-reference/19-2760-imgOgnevny.png",
  "19-2760/imgMacraig": "/landing-reference/19-2760-imgMacraig.png",
  "19-2760/imgCharlesChen0823": "/landing-reference/19-2760-imgCharlesChen0823.png",
  "19-3464/imgImage": "/landing-reference/19-3464-imgImage.png",
  "19-3464/imgExplorePosterWebp": "/landing-reference/19-3464-imgExplorePosterWebp.png",
  "19-3464/imgImage1": "/landing-reference/19-3464-imgImage1.png",
  "19-3464/imgFrame": "/landing-reference/19-3464-imgFrame.svg",
  "19-3464/imgFrame1": "/landing-reference/19-3464-imgFrame1.svg",
  "19-3464/imgFrame2": "/landing-reference/19-3464-imgFrame2.svg",
  "19-3464/imgFrame3": "/landing-reference/19-3464-imgFrame3.svg",
  "19-4211/imgXanaduWasWaitingForAgents": "/landing-reference/19-4211-imgXanaduWasWaitingForAgents.png",
  "19-4211/imgNathanSobo": "/landing-reference/19-4211-imgNathanSobo.png",
  "19-4211/imgIntroducingDelta": "/landing-reference/19-4211-imgIntroducingDelta.png",
  "19-4211/imgSandboxing": "/landing-reference/19-4211-imgSandboxing.png",
  "19-4211/imgCameronMcloughlin": "/landing-reference/19-4211-imgCameronMcloughlin.png",
  "19-4211/imgFrame": "/landing-reference/19-4211-imgFrame.svg",
  "19-2527/imgSidebarWebp": "/landing-reference/19-2527-imgSidebarWebp.png",
  "19-2527/imgDebuggerWebp": "/landing-reference/19-2527-imgDebuggerWebp.png",
  "19-2527/imgImage": "/landing-reference/19-2527-imgImage.png",
  "19-2527/imgAgentWebp": "/landing-reference/19-2527-imgAgentWebp.png",
  "19-2527/imgImage1": "/landing-reference/19-2527-imgImage1.png",
  "19-2527/imgGitWebp": "/landing-reference/19-2527-imgGitWebp.png",
  "19-2527/imgImage2": "/landing-reference/19-2527-imgImage2.png",
  "19-2527/imgEpWebp": "/landing-reference/19-2527-imgEpWebp.png",
  "19-2527/imgImage3": "/landing-reference/19-2527-imgImage3.png",
  "19-2527/imgFrame": "/landing-reference/19-2527-imgFrame.svg",
  "19-2527/imgFrame1": "/landing-reference/19-2527-imgFrame1.svg",
  "19-4390/imgDivPointerEventsNone": "/landing-reference/19-4390-imgDivPointerEventsNone.png",
  "19-4390/imgFrame": "/landing-reference/19-4390-imgFrame.svg",
  "19-287/imgFrame": "/landing-reference/19-287-imgFrame.svg",
  "19-287/imgFrame1": "/landing-reference/19-287-imgFrame1.svg",
  "19-287/imgFrame2": "/landing-reference/19-287-imgFrame2.svg",
  "19-287/imgFrame3": "/landing-reference/19-287-imgFrame3.svg",
  "19-287/imgFrame4": "/landing-reference/19-287-imgFrame4.svg",
  "19-287/imgFrame5": "/landing-reference/19-287-imgFrame5.svg",
  "19-287/imgFrame6": "/landing-reference/19-287-imgFrame6.svg",
  "19-287/imgFrame7": "/landing-reference/19-287-imgFrame7.svg",
  "19-287/imgGroup": "/landing-reference/19-287-imgGroup.svg",
  "19-287/imgGroup1": "/landing-reference/19-287-imgGroup1.svg",
  "19-4325/imgDivPointerEventsNone": "/landing-reference/19-4325-imgDivPointerEventsNone.png",
  "19-4325/imgZedsLogo": "/landing-reference/19-4325-imgZedsLogo.png",
  "19-4325/imgImage": "/landing-reference/19-4325-imgImage.png",
  "19-4325/imgFrame": "/landing-reference/19-4325-imgFrame.svg",
  "19-4325/imgFrame1": "/landing-reference/19-4325-imgFrame1.svg",
  "19-4325/imgFrame2": "/landing-reference/19-4325-imgFrame2.svg",
  "19-4560/imgFrame": "/landing-reference/19-4560-imgFrame.svg",
  "19-4560/imgFrame1": "/landing-reference/19-4560-imgFrame1.svg",
  "19-4560/imgFrame2": "/landing-reference/19-4560-imgFrame2.svg",
  "19-4560/imgFrame3": "/landing-reference/19-4560-imgFrame3.svg",
  "19-4560/imgFrame4": "/landing-reference/19-4560-imgFrame4.svg",
  "19-4560/imgFrame5": "/landing-reference/19-4560-imgFrame5.svg",
  "19-1051/imgFrame": "/landing-reference/19-1051-imgFrame.svg",
  "19-1051/imgFrame1": "/landing-reference/19-1051-imgFrame1.svg",
  "19-1051/imgFrame2": "/landing-reference/19-1051-imgFrame2.svg",
  "19-1051/imgFrame3": "/landing-reference/19-1051-imgFrame3.svg",
  "19-1051/imgFrame4": "/landing-reference/19-1051-imgFrame4.svg",
  "19-1051/imgFrame5": "/landing-reference/19-1051-imgFrame5.svg",
  "19-1051/imgFrame6": "/landing-reference/19-1051-imgFrame6.svg",
  "19-4121/imgNathanSobo": "/landing-reference/19-4121-imgNathanSobo.png",
  "19-4121/imgAntonioScandurra": "/landing-reference/19-4121-imgAntonioScandurra.png",
  "19-4121/imgMaxBrunsfeld": "/landing-reference/19-4121-imgMaxBrunsfeld.png",
  "19-4121/imgDivPointerEventsNone": "/landing-reference/19-4121-imgDivPointerEventsNone.svg",
  "19-4121/imgLogoBlueNoGradientPadded064I3Nucm1OqoSvg": "/landing-reference/19-4121-imgLogoBlueNoGradientPadded064I3Nucm1OqoSvg.svg",
  "19-4121/imgSvgAnimateSpinSlow": "/landing-reference/19-4121-imgSvgAnimateSpinSlow.svg",
  "19-4121/imgVector": "/landing-reference/19-4121-imgVector.svg",
  "19-3974/imgImage": "/landing-reference/19-3974-imgImage.png",
  "19-3974/imgLspWebp": "/landing-reference/19-3974-imgLspWebp.png",
  "19-3974/imgFrame": "/landing-reference/19-3974-imgFrame.svg",
  "19-3974/imgFrame1": "/landing-reference/19-3974-imgFrame1.svg",
  "19-3974/imgFrame2": "/landing-reference/19-3974-imgFrame2.svg",
  "19-3974/imgFrame3": "/landing-reference/19-3974-imgFrame3.svg",
  "19-3558/imgFrame": "/landing-reference/19-3558-imgFrame.svg",
  "19-3558/imgDivGrid": "/landing-reference/19-3558-imgDivGrid.svg",
  "19-3558/imgFrame1": "/landing-reference/19-3558-imgFrame1.svg",
  "19-3558/imgFrame2": "/landing-reference/19-3558-imgFrame2.svg",
  "19-3558/imgFrame3": "/landing-reference/19-3558-imgFrame3.svg",
  "19-3558/imgFrame4": "/landing-reference/19-3558-imgFrame4.svg",
  "19-2328/imgJoseValimsAvatar": "/landing-reference/19-2328-imgJoseValimsAvatar.png",
  "19-2328/imgEthanPerezsAvatar": "/landing-reference/19-2328-imgEthanPerezsAvatar.png",
  "19-2328/imgDanAbramovsAvatar": "/landing-reference/19-2328-imgDanAbramovsAvatar.png",
  "19-2328/imgMattBakersAvatar": "/landing-reference/19-2328-imgMattBakersAvatar.png",
  "19-2328/imgMikeBostocksAvatar": "/landing-reference/19-2328-imgMikeBostocksAvatar.png",
  "19-2328/imgDivHAuto": "/landing-reference/19-2328-imgDivHAuto.svg",
  "19-2328/imgFrame": "/landing-reference/19-2328-imgFrame.svg",
  "19-2328/imgFrame1": "/landing-reference/19-2328-imgFrame1.svg",
  "19-2328/imgFrame2": "/landing-reference/19-2328-imgFrame2.svg",
  "19-2328/imgFrame3": "/landing-reference/19-2328-imgFrame3.svg",
  "19-2328/imgFrame4": "/landing-reference/19-2328-imgFrame4.svg",
  "19-2328/imgFrame5": "/landing-reference/19-2328-imgFrame5.svg",
  "19-2328/imgFrame6": "/landing-reference/19-2328-imgFrame6.svg",
  "19-2328/imgFrame7": "/landing-reference/19-2328-imgFrame7.svg",
  "19-2328/imgFrame8": "/landing-reference/19-2328-imgFrame8.svg",
  "19-2328/imgFrame9": "/landing-reference/19-2328-imgFrame9.svg",
  "19-2328/imgFrame10": "/landing-reference/19-2328-imgFrame10.svg",
  "19-2328/imgFrame11": "/landing-reference/19-2328-imgFrame11.svg",
  "19-2328/imgFrame12": "/landing-reference/19-2328-imgFrame12.svg",
  "19-2328/imgFrame13": "/landing-reference/19-2328-imgFrame13.svg",
  "19-2328/imgFrame14": "/landing-reference/19-2328-imgFrame14.svg",
  "19-2328/imgFrame15": "/landing-reference/19-2328-imgFrame15.svg",
  "19-2328/imgFrame16": "/landing-reference/19-2328-imgFrame16.svg",
  "hero/imgFrame": "/landing-reference/hero-imgFrame.svg",
  "hero/imgFrame1": "/landing-reference/hero-imgFrame1.svg",
  "hero/imgFrame2": "/landing-reference/hero-imgFrame2.svg",
  "hero/imgFrame3": "/landing-reference/hero-imgFrame3.svg",
  "hero/imgFrame4": "/landing-reference/hero-imgFrame4.svg"
};

export const referenceExtensions = [
  [
    "HTML",
    "6.4M",
    "HTML support.",
    "Isaac Clayton"
  ],
  [
    "Git Firefly",
    "1.7M",
    "Provides Git Syntax Highlighting",
    "d1y, Peter Tripp"
  ],
  [
    "TOML",
    "1.3M",
    "TOML support.",
    "Max Brunsfeld, Ammar Arif"
  ],
  [
    "Java",
    "1.2M",
    "Java support.",
    "Java Extension Contributors"
  ],
  [
    "Dockerfile",
    "1.1M",
    "Dockerfile and Docker Compose support.",
    "d1y, joshmeads"
  ],
  [
    "Catppuccin",
    "992k",
    "🦀 Soothing pastel theme for Zed",
    "Catppuccin"
  ],
  [
    "SQL",
    "805k",
    "SQL language support.",
    "nervenes, notpeter, phileix, tammyxiong"
  ],
  [
    "PHP",
    "771k",
    "PHP support.",
    "Piotr Osiewicz"
  ],
  [
    "Vue",
    "660k",
    "Vue support.",
    "Zed Industries"
  ],
  [
    "Ruby",
    "546k",
    "Ruby support.",
    "Vitaly Slobodin"
  ],
  [
    "Catppuccin Icons",
    "495k",
    "🦊 Soothing pastel icons for Zed",
    "Catppuccin"
  ],
  [
    "macOS Classic Theme",
    "481k",
    "A macOS native style theme, let it same like native app in macOS.",
    "Jason Lee"
  ],
  [
    "SCSS & SASS",
    "457k",
    "SCSS and SASS support",
    "Raunak Raj"
  ],
  [
    "C#",
    "444k",
    "C# support.",
    "fminkowski, Fabian Freimueller"
  ],
  [
    "Material Icon Theme",
    "421k",
    "Material Design icons.",
    "Zed Industries"
  ],
  [
    "Make",
    "413k",
    "Makefile syntax highlighting",
    "Caius Durling, d1y, Marshall Bowers, Luke Naylor, Igor Támara, Michael Alexander, Donnie Adams"
  ],
  [
    "Tokyo Night Themes",
    "412k",
    "Tokyo Night Themes",
    "ssaunderss"
  ],
  [
    "XML",
    "412k",
    "XML syntax support.",
    "sweetppro"
  ],
  [
    "Lua",
    "371k",
    "Lua support.",
    "Max Brunsfeld"
  ],
  [
    "Terraform",
    "340k",
    "Terraform support.",
    "Caius Durling, Daniel Banck"
  ]
];

export const referenceCodeRows = [[{"gap":24.8,"width":8,"segments":[{"text":"1","color":"#b4b4bb"}]},{"gap":20.0,"width":87,"segments":[{"text":"\"use client\"","color":"#649f57"}]}],[{"gap":24.8,"width":8,"segments":[{"text":"2","color":"#b4b4bb"}]}],[{"gap":24.8,"width":8,"segments":[{"text":"3","color":"#b4b4bb"}]},{"gap":20.0,"width":216,"segments":[{"text":"import","color":"#a449ab"},{"text":" ","color":"#242529"},{"text":"*","color":"#3882b7"},{"text":" ","color":"#242529"},{"text":"as","color":"#a449ab"},{"text":" React ","color":"#242529"},{"text":"from","color":"#a449ab"},{"text":" ","color":"#242529"},{"text":"\"react\"","color":"#649f57"}]}],[{"gap":24.8,"width":8,"segments":[{"text":"4","color":"#b4b4bb"}]},{"gap":20.0,"width":389,"segments":[{"text":"import","color":"#a449ab"},{"text":" ","color":"#242529"},{"text":"{","color":"#4d4f52"},{"text":" format","color":"#242529"},{"text":",","color":"#4d4f52"},{"text":" addMinutes","color":"#242529"},{"text":",","color":"#4d4f52"},{"text":" isAfter ","color":"#242529"},{"text":"}","color":"#4d4f52"},{"text":" ","color":"#242529"},{"text":"from","color":"#a449ab"},{"text":" ","color":"#242529"},{"text":"\"date-fns\"","color":"#649f57"}]}],[{"gap":24.8,"width":8,"segments":[{"text":"5","color":"#b4b4bb"}]}],[{"gap":24.8,"width":8,"segments":[{"text":"6","color":"#44454b"}]},{"gap":20.0,"width":310,"segments":[{"text":"// Types for our \"essential\" meeting system","color":"#a2a3a7"}]}],[{"gap":24.8,"width":8,"segments":[{"text":"7","color":"#b4b4bb"}]},{"gap":20.0,"width":137,"segments":[{"text":"interface","color":"#a449ab"},{"text":" ","color":"#242529"},{"text":"Meeting","color":"#3882b7"},{"text":" ","color":"#242529"},{"text":"{","color":"#4d4f52"}]}],[{"gap":24.8,"width":8,"segments":[{"text":"8","color":"#b4b4bb"}]},{"gap":48.8,"width":72,"segments":[{"text":"id","color":"#d3604f"},{"text":":","color":"#b92b46"},{"text":" ","color":"#242529"},{"text":"string","color":"#3882b7"}]}],[{"gap":24.8,"width":8,"segments":[{"text":"9","color":"#b4b4bb"}]},{"gap":48.8,"width":94,"segments":[{"text":"title","color":"#d3604f"},{"text":":","color":"#b92b46"},{"text":" ","color":"#242529"},{"text":"string","color":"#3882b7"}]}],[{"gap":17.8,"width":15,"segments":[{"text":"10","color":"#b4b4bb"}]},{"gap":48.8,"width":144,"segments":[{"text":"couldHaveBeenAnEmail","color":"#d3604f"}]},{"gap":0.0,"width":65.2,"segments":[{"text":":","color":"#b92b46"},{"text":" ","color":"#242529"},{"text":"boolean","color":"#3882b7"}]},{"gap":11.61,"width":454,"segments":[{"text":"'couldHaveBeenAnEmail' is declared but its value is never read.","color":"#a48819"}]}],[{"gap":17.8,"width":15,"segments":[{"text":"11","color":"#b4b4bb"}]},{"gap":48.8,"width":137,"segments":[{"text":"attendees","color":"#d3604f"},{"text":":","color":"#b92b46"},{"text":" ","color":"#242529"},{"text":"string","color":"#3882b7"},{"text":"[]","color":"#4d4f52"}]}],[{"gap":17.8,"width":15,"segments":[{"text":"12","color":"#b4b4bb"}]},{"gap":48.8,"width":166,"segments":[{"text":"snacksProvided","color":"#d3604f"},{"text":":","color":"#b92b46"},{"text":" ","color":"#242529"},{"text":"boolean","color":"#3882b7"}]}],[{"gap":17.8,"width":15,"segments":[{"text":"13","color":"#b4b4bb"}]},{"gap":48.8,"width":144,"segments":[{"text":"actuallyStartsOnTime","color":"#d3604f"}]},{"gap":0.0,"width":58.17,"segments":[{"text":":","color":"#b92b46"},{"text":" ","color":"#242529"},{"text":"number","color":"#3882b7"}]},{"gap":11.44,"width":353,"segments":[{"text":"Type 'string' is not assignable to type 'number'.","color":"#d36151"}]}],[{"gap":17.8,"width":15,"segments":[{"text":"14","color":"#b4b4bb"}]},{"gap":20.0,"width":8,"segments":[{"text":"}","color":"#4d4f52"}]}],[{"gap":17.8,"width":15,"segments":[{"text":"15","color":"#b4b4bb"}]}],[{"gap":17.8,"width":15,"segments":[{"text":"16","color":"#b4b4bb"}]},{"gap":20.0,"width":540.11,"segments":[{"text":"type","color":"#a449ab"},{"text":" ","color":"#242529"},{"text":"MeetingStatus","color":"#3882b7"},{"text":" ","color":"#242529"},{"text":"=","color":"#3882b7"},{"text":" ","color":"#242529"},{"text":"\"scheduled\"","color":"#649f57"},{"text":" ","color":"#242529"},{"text":"|","color":"#b92b46"},{"text":" ","color":"#242529"},{"text":"\"running-late\"","color":"#649f57"},{"text":" ","color":"#242529"},{"text":"|","color":"#b92b46"},{"text":" ","color":"#242529"},{"text":"\"cancelled\"","color":"#649f57"},{"text":" ","color":"#242529"},{"text":"|","color":"#b92b46"},{"text":" ","color":"#242529"},{"text":"\"eternal\"","color":"#649f57"}]}],[{"gap":17.8,"width":15,"segments":[{"text":"17","color":"#b4b4bb"}]}],[{"gap":17.8,"width":15,"segments":[{"text":"18","color":"#b4b4bb"}]},{"gap":20.0,"width":180.14,"segments":[{"text":"function","color":"#a449ab"},{"text":" ","color":"#242529"},{"text":"validateMeeting","color":"#5b79e3"},{"text":"(","color":"#4d4f52"}]},{"gap":-0.14,"width":58,"segments":[{"text":"atendees","color":"#d3604f"}]},{"gap":-0.39,"width":159.12,"segments":[{"text":":","color":"#b92b46"},{"text":" ","color":"#242529"},{"text":"string","color":"#3882b7"},{"text":"[])","color":"#4d4f52"},{"text":":","color":"#b92b46"},{"text":" ","color":"#242529"},{"text":"boolean","color":"#3882b7"},{"text":" ","color":"#242529"},{"text":"{","color":"#4d4f52"}]},{"gap":11.31,"width":439,"segments":[{"text":"Consider using 'attendees' instead of 'atendees' for clarity.","color":"#5c78e2"}]}],[{"gap":17.8,"width":15,"segments":[{"text":"19","color":"#b4b4bb"}]},{"gap":48.8,"width":360,"segments":[{"text":"return","color":"#a449ab"},{"text":" atendees","color":"#242529"},{"text":".","color":"#4d4f52"},{"text":"length","color":"#d3604f"},{"text":" ","color":"#242529"},{"text":">","color":"#3882b7"},{"text":" ","color":"#242529"},{"text":"0","color":"#ad6e25"},{"text":" ","color":"#242529"},{"text":"&&","color":"#3882b7"},{"text":" atendees","color":"#242529"},{"text":".","color":"#4d4f52"},{"text":"length","color":"#d3604f"},{"text":" ","color":"#242529"},{"text":"<","color":"#3882b7"},{"text":" ","color":"#242529"},{"text":"50","color":"#ad6e25"}]}],[{"gap":17.8,"width":15,"segments":[{"text":"20","color":"#b4b4bb"}]},{"gap":20.0,"width":8,"segments":[{"text":"}","color":"#4d4f52"}]}],[{"gap":17.8,"width":15,"segments":[{"text":"21","color":"#b4b4bb"}]}],[{"gap":17.8,"width":15,"segments":[{"text":"22","color":"#b4b4bb"}]},{"gap":20.0,"width":22.2,"segments":[{"text":"let","color":"#a449ab"},{"text":" ","color":"#242529"}]},{"gap":6.6,"width":72,"segments":[{"text":"agendaItem","color":"#242529"}]},{"gap":7.2,"width":267.1,"segments":[{"text":"=","color":"#3882b7"},{"text":" ","color":"#242529"},{"text":"\"Discuss why we need more meetings\"","color":"#649f57"}]},{"gap":11.31,"width":497,"segments":[{"text":"'agendaItem' can be declared as 'const' since it is never reassigned.","color":"#7274a7"}]}],[{"gap":17.8,"width":15,"segments":[{"text":"23","color":"#b4b4bb"}]}],[{"gap":17.8,"width":15,"segments":[{"text":"24","color":"#b4b4bb"}]},{"gap":20.0,"width":180,"segments":[{"text":"const","color":"#a449ab"},{"text":" ","color":"#242529"},{"text":"MEETING_EXCUSES","color":"#c18401"},{"text":" ","color":"#242529"},{"text":"=","color":"#3882b7"},{"text":" ","color":"#242529"},{"text":"[","color":"#4d4f52"}]}]];

export const referenceTerminalRows = [["  ███████╗███████╗██████╗  ", "#0997b3"], ["  ╚══███╔╝██╔════╝██╔══██╗ ", "#3f953a"], ["    ███╔╝ █████╗  ██║  ██║ ", "#d2b67c"], ["   ███╔╝  ██╔══╝  ██║  ██║ ", "#950095"], ["  ███████╗███████╗██████╔╝ ", "#2f5af3"], ["  ╚══════╝╚══════╝╚═════╝  ", "#de3e35"]];
