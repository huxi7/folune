# 首屏 Demo 第三方源码

2026-09-19 当前入口使用 Paper Shaders 0.0.80 的 GrainGradient、Dithering、Warp（仅原版参照）和 ShaderMount。inkShader.ts 为本项目本轮编写的局部 GLSL，未复制或修改 Paper Shader 源码。下方 React Bits/Aceternity 源码已退出入口，仅保留历史文件及许可证。

ReactBitsWaves.tsx：复制自 React Bits 官方 TS/CSS Waves，2026-09-18 获取。保留 Perlin、网格点运动和绘制实现，局部修改为确定种子、暂停/恢复、DPR 上限、ResizeObserver、无指针与严格数组边界类型。无 npm 安装步骤，因为 React Bits 以源码分发。
源文件：https://github.com/DavidHDev/react-bits/blob/main/src/ts-default/Backgrounds/Waves/Waves.tsx
许可：https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md

MIT + Commons Clause License Condition v1.0

Copyright (c) 2026 David Haz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, and distribute the Software **as part of an application, website, or product**, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

## Commons Clause Restriction

You may use this Software, including for any commercial purpose, **so long as you do not sell, sublicense, or redistribute the components themselves-whether alone, in a bundle, or as a ported version.**

## No Warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Aceternity UI

AceternityBeams.tsx：复制自 https://ui.aceternity.com/registry/background-beams.json ，2026-09-18 获取。保留原始路径与逐路径渐变运动，修改为单色、稀疏渲染、固定时间线、实例唯一 ID 和暂停控制。
作者 Manu Arora 官方组件目录标记 MIT：https://21st.dev/@manuarora700/components/background-beams.md

MIT License

Copyright (c) Manu Arora

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Paper Shaders

直接引用项目已有 @paper-design/shaders-react 0.0.80（Apache-2.0），原始 NOTICE/LICENSE 保留在包内，不复制或改写包内 GLSL 源码；局部 shader 通过库提供的 ShaderMount 加载。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
