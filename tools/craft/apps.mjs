/**
 * One entry per craft plugin. This is the ONLY place app-specific facts live:
 * the generator below turns each entry into a self-contained plugin directory.
 *
 * Rules that keep this honest:
 *  - `payload` numbers were measured from the downloaded upstream release zips
 *    (`shasum -a 256`), never copied from a README.
 *  - Detail copy describes what the upstream app does today. Feature claims must
 *    be traceable to that repo's own docs; "not there yet" is said out loud.
 *  - Showcase copy has a hard budget: it must fit the capability page's fixed
 *    height without being clipped (see generate.mjs assertShowcase).
 */

/** upstream archive name + release tag are derived from `id` and `payload.version`. */
export const APPS = [
  {
    id: "photocraft",
    name: "Photocraft",
    tabLabel: "Photocraft",
    tabOrder: 16,
    pluginVersion: "0.0.5",
    serviceId: "photocraft-hub",
    repo: "https://github.com/storytold/photocraft",
    license: "MIT OR Apache-2.0",
    category: "Design",
    tags: ["image-editing", "photoshop", "psd", "layers", "design"],
    tagsZh: ["图片编辑", "PSD", "图层", "设计"],
    summary:
      "Edit images with layers, masks, type and real PSD files inside Astravia — the upstream Photocraft editor with a Chinese interface by default, also openable in a browser.",
    summaryZh:
      "在 Astravia 里编辑图片：图层、蒙版、文字与真实的 PSD 文件，用的是上游原版 Photocraft 编辑器；界面默认中文，也可以改在浏览器里打开。",
    payload: {
      version: "0.19.0",
      size: 13433636,
      sha256: "74047f06da706c5b7c9dee77e05379a0928c52b5a7ea1e821e55c69851b0bd01",
      localFile: "photocraft-web-0.19.0.zip",
      sizeLabel: "13 MB",
    },
    seed: { key: "photocraft.preferences", value: '{"version":2,"interface":{"language":"zh-hans"}}' },
    nosw: false,
    docs: { kind: "book", path: "book/src" },
    skill: {
      alias: "Photocraft 图片编辑",
      description:
        "Work on raster images in Photocraft inside Astravia: layers, masks, selections, type, adjustment layers and PSD files. Use when the task is editing a photo or a layered image, opening or saving a .psd, or handing an image from the workspace to the editor and back.",
      intro:
        "Photocraft is a raster image editor. The tab runs upstream's own web build in an iframe — same wasm, same JavaScript, no fork — so anything the editor can do it can do here; what this plugin adds is the doorway: a workspace file goes in, the saved bytes come back to the same path.",
    },
    detail: {
      en: {
        heroTitle: "Photocraft in the activity panel",
        eyebrow: "Image editing",
        heroDescription:
          "Layers, masks, type and real PSD files — the upstream Photocraft editor running inside Astravia, on your own machine, with the file you opened in the workspace.",
        badges: ["No fork", "Local", "PSD"],
        showcase: {
          canvas: "generic",
          user: "Open assets/cover.png here.",
          assistant: "Photocraft is open. Select the file in the Explorer, then press Open — it takes that file.",
        },
        features: [
          {
            title: "The real editor, unmodified",
            description:
              "The panel serves the official Photocraft web build byte for byte. Upstream's wasm and JavaScript are not patched; only two thin files of ours are added around them.",
            icon: "solar:gallery-wide-linear",
          },
          {
            title: "Open and save inside your project",
            description:
              "Opening uses the file you selected in the Explorer, and saving writes back through Astravia — so the bytes land in your workspace instead of a downloads folder.",
            icon: "solar:folder-with-files-linear",
          },
          {
            title: "Speak to it in the conversation",
            description:
              "Ask for the current view, hand the editor a file, or open the same page in a browser — five tools the Agent calls, each one answered by the running page.",
            icon: "solar:chat-round-linear",
          },
        ],
        steps: [
          {
            title: "Install the plugin",
            description:
              "Add it from the marketplace. The editor's own files are about 13 MB, fetched once on first open into the plugin's data directory, and reused offline after that.",
          },
          {
            title: "Open the Photocraft tab",
            description:
              "The first open shows a preparation screen while the editor arrives; after that it starts from cache without touching the network.",
          },
          {
            title: "Select an image in the Explorer, then open it",
            description: "Inside the editor, File → Open takes the file you selected instead of showing a dialog.",
          },
          {
            title: "Save back with File → Save",
            description: "The working copy is written to the same path. Export… asks where to save instead.",
          },
        ],
        callouts: [
          {
            tone: "info",
            content:
              "In the browser entry points there is no workspace binding: opening a file there uses the browser's own picker and saving downloads through the browser. Working on project files happens in the Astravia tab.",
          },
          {
            tone: "warning",
            content:
              "Photocraft has no way to tell the panel whether a document has unsaved edits, so reloading the tab asks nothing. The editor's own title bar is the only unsaved marker.",
          },
        ],
        links: [
          { label: "Photocraft on GitHub", href: "https://github.com/storytold/photocraft" },
          { label: "Photocraft releases", href: "https://github.com/storytold/photocraft/releases" },
        ],
      },
      zh: {
        heroTitle: "在活动面板里用 Photocraft",
        eyebrow: "图片编辑",
        heroDescription:
          "图层、蒙版、文字与真实的 PSD 文件——上游原版 Photocraft 编辑器跑在 Astravia 里，在你自己的机器上，打开的就是工作区里选中的那个文件。",
        badges: ["不改上游", "本地运行", "PSD"],
        showcase: {
          canvas: "generic",
          user: "在这里打开 assets/cover.png。",
          assistant: "Photocraft 已打开。在资源管理器选中文件，再点打开，它会直接用这个文件。",
        },
        features: [
          {
            title: "原版编辑器，一个字节都不改",
            description:
              "面板逐字节地把 Photocraft 官方 web 构建送进浏览器；上游的 wasm 与 JavaScript 不做任何补丁，我们自己只在其外围加了两个很薄的文件。",
            icon: "solar:gallery-wide-linear",
          },
          {
            title: "在工作区里打开与保存",
            description:
              "打开用的是你在资源管理器选中的文件，保存经 Astravia 写回原路径——字节落在项目里，而不是下载文件夹。",
            icon: "solar:folder-with-files-linear",
          },
          {
            title: "在对话里直接指挥它",
            description:
              "要当前画面、把文件交给编辑器、或在浏览器里打开同一页——五个 Agent 工具，每一个的结果都由运行中的页面回答。",
            icon: "solar:chat-round-linear",
          },
        ],
        steps: [
          {
            title: "安装插件",
            description:
              "从市场添加即可。编辑器自身的文件约 13 MB，首次打开时下载一次到插件数据目录，之后离线复用。",
          },
          {
            title: "打开 Photocraft 标签页",
            description: "首次打开会显示准备页，等编辑器文件到位；之后直接从缓存启动，不再访问网络。",
          },
          {
            title: "在资源管理器选中一张图，再打开",
            description: "在编辑器里按「文件 → 打开」，它会用你选中的那个文件，而不是弹系统对话框。",
          },
          {
            title: "用「文件 → 保存」写回",
            description: "写回同一路径；「导出…」才是问你保存到哪里。",
          },
        ],
        callouts: [
          {
            tone: "info",
            content:
              "浏览器入口没有工作区绑定：在那里打开文件走浏览器自己的选择框，保存走浏览器下载。处理项目文件请用 Astravia 标签页。",
          },
          {
            tone: "warning",
            content:
              "Photocraft 无法告诉面板文档有没有未保存的修改，所以重新载入标签页不会拦你。唯一的未保存提示在编辑器自己的标题栏上。",
          },
        ],
        links: [
          { label: "Photocraft 源码", href: "https://github.com/storytold/photocraft" },
          { label: "Photocraft 版本发布", href: "https://github.com/storytold/photocraft/releases" },
        ],
      },
    },
  },

  {
    id: "designcraft",
    name: "DesignCraft",
    tabLabel: "DesignCraft",
    tabOrder: 17,
    pluginVersion: "0.0.1",
    serviceId: "designcraft-hub",
    repo: "https://github.com/storytold/designcraft",
    license: "MIT OR Apache-2.0",
    category: "Design",
    tags: ["page-layout", "desktop-publishing", "indesign", "idml", "pdf"],
    tagsZh: ["排版", "出版", "IDML", "PDF"],
    summary:
      "Lay out pages, spreads and threaded text inside Astravia — the upstream DesignCraft publishing editor, with IDML import and PDF, PNG and EPUB export.",
    summaryZh:
      "在 Astravia 里做版面：页面、对页、串接文本框，用的是上游原版 DesignCraft 出版编辑器，可导入 IDML，导出 PDF、PNG 与 EPUB。",
    payload: {
      version: "0.16.0",
      size: 26783459,
      sha256: "1e74074b32d59185210042f303f28041b49dd3cc1a70d4d378a75ef23e4b0186",
      localFile: "designcraft-web-0.16.0.zip",
      sizeLabel: "26 MB",
    },
    seed: null,
    nosw: false,
    docs: { kind: "user", path: "docs/user" },
    skill: {
      alias: "DesignCraft 排版出版",
      description:
        "Lay out pages in DesignCraft inside Astravia: spreads, parent pages, text frames, styles, and export to PDF, PNG or EPUB. Use when the task is a brochure, report, poster or book layout, or when an IDML file has to be opened, edited and exported.",
      intro:
        "DesignCraft is a page-layout application — the open-source, modern desktop-publishing studio. The tab runs upstream's own web build unmodified; this plugin adds only the doorway, so a workspace file can be opened and the exported bytes written back through Astravia.",
    },
    detail: {
      en: {
        heroTitle: "DesignCraft in the activity panel",
        eyebrow: "Page layout",
        heroDescription:
          "Spreads, parent pages and threaded text frames — the upstream DesignCraft publishing editor running inside Astravia, with the document you opened in the workspace.",
        badges: ["No fork", "Local", "IDML"],
        showcase: {
          canvas: "design",
          user: "Open brochure.idml here.",
          assistant: "DesignCraft is open. Select the file in the Explorer, then press Open — it takes that file.",
        },
        features: [
          {
            title: "The real layout engine",
            description:
              "The panel serves the official DesignCraft web build byte for byte; upstream's wasm and JavaScript are not patched, and only two thin files of ours are added around them.",
            icon: "solar:layers-minimalistic-linear",
          },
          {
            title: "Open and export inside your project",
            description:
              "Opening uses the file selected in the Explorer, and exports are written back through Astravia instead of landing in a downloads folder.",
            icon: "solar:folder-with-files-linear",
          },
          {
            title: "Ask for the current page",
            description:
              "A capture tool saves a PNG of what the canvas is showing, and a status tool reports whether the editor actually finished starting.",
            icon: "solar:chat-round-linear",
          },
        ],
        steps: [
          {
            title: "Install the plugin",
            description:
              "About 26 MB of editor files arrive on first open, into the plugin's data directory, and are reused offline after that.",
          },
          {
            title: "Open the DesignCraft tab",
            description: "The preparation screen is the hub fetching its payload; later opens start from cache.",
          },
          {
            title: "Select a document, then open it",
            description:
              "File → Open inside the editor takes the file selected in Astravia rather than showing a system dialog.",
          },
          {
            title: "Export back through the workspace",
            description: "Exports travel the same bridge as saves, so the result lands where you chose.",
          },
        ],
        callouts: [
          {
            tone: "info",
            content:
              "DesignCraft describes itself as pre-alpha: expect missing features and changing files. The plugin runs whatever the pinned release does — it does not add layout features of its own.",
          },
          {
            tone: "info",
            content:
              "In the browser entry points there is no workspace binding: opening a file there uses the browser's picker and exports download through the browser.",
          },
        ],
        links: [
          { label: "DesignCraft on GitHub", href: "https://github.com/storytold/designcraft" },
          { label: "DesignCraft releases", href: "https://github.com/storytold/designcraft/releases" },
        ],
      },
      zh: {
        heroTitle: "在活动面板里用 DesignCraft",
        eyebrow: "版式设计",
        heroDescription:
          "页面、对页、串接文本框——上游原版 DesignCraft 出版编辑器跑在 Astravia 里，打开的就是工作区里的那份文档。",
        badges: ["不改上游", "本地运行", "IDML"],
        showcase: {
          canvas: "design",
          user: "在这里打开 brochure.idml。",
          assistant: "DesignCraft 已打开。在资源管理器选中文件，再点打开，它会直接用这个文件。",
        },
        features: [
          {
            title: "原版排版引擎",
            description:
              "面板逐字节送出 DesignCraft 官方 web 构建；上游 wasm 与 JavaScript 不打补丁，我们只在其外围加了两个薄文件。",
            icon: "solar:layers-minimalistic-linear",
          },
          {
            title: "在项目里打开与导出",
            description: "打开用资源管理器选中的文件，导出经 Astravia 写回，不落到下载文件夹。",
            icon: "solar:folder-with-files-linear",
          },
          {
            title: "随时问它现在是什么样",
            description: "截图工具把画布当前画面存成 PNG，状态工具如实报告编辑器到底有没有启动完成。",
            icon: "solar:chat-round-linear",
          },
        ],
        steps: [
          {
            title: "安装插件",
            description: "首次打开时下载约 26 MB 编辑器文件到插件数据目录，之后离线复用。",
          },
          {
            title: "打开 DesignCraft 标签页",
            description: "准备页就是 hub 在取 payload；之后从缓存启动。",
          },
          {
            title: "选中文档再打开",
            description: "在编辑器里按「文件 → 打开」，用的是 Astravia 里选中的文件，而不是系统对话框。",
          },
          {
            title: "导出同样走工作区",
            description: "导出与保存走同一条桥，结果落在你选的位置。",
          },
        ],
        callouts: [
          {
            tone: "info",
            content:
              "DesignCraft 自述处于 pre-alpha：功能会缺、文件格式会变。插件只运行钉住的那个版本，不额外实现排版功能。",
          },
          {
            tone: "info",
            content: "浏览器入口没有工作区绑定：那里打开文件走浏览器选择框，导出走浏览器下载。",
          },
        ],
        links: [
          { label: "DesignCraft 源码", href: "https://github.com/storytold/designcraft" },
          { label: "DesignCraft 版本发布", href: "https://github.com/storytold/designcraft/releases" },
        ],
      },
    },
  },

  {
    id: "effectcraft",
    name: "EffectCraft",
    tabLabel: "EffectCraft",
    tabOrder: 18,
    pluginVersion: "0.0.1",
    serviceId: "effectcraft-hub",
    repo: "https://github.com/storytold/effectcraft",
    license: "MIT OR Apache-2.0",
    category: "Media",
    tags: ["motion-graphics", "vfx", "compositing", "animation", "after-effects"],
    tagsZh: ["动态图形", "视觉特效", "合成", "动画"],
    summary:
      "Build motion-graphics compositions inside Astravia — the upstream EffectCraft compositor with keyframes, 3D camera and lights, 308 effects and a render queue.",
    summaryZh:
      "在 Astravia 里做动态图形：关键帧、3D 相机与灯光、308 个效果、渲染队列，用的是上游原版 EffectCraft 合成器。",
    payload: {
      version: "0.20.0",
      size: 21591778,
      sha256: "24189ed0dc8e9b5ed893dbd65b27f4f130ce5294b4a4f6b4cd506746f916c13e",
      localFile: "effectcraft-web-0.20.0.zip",
      sizeLabel: "21 MB",
    },
    seed: null,
    nosw: true,
    docs: { kind: "user", path: "docs/user" },
    skill: {
      alias: "EffectCraft 动态图形",
      description:
        "Animate compositions in EffectCraft inside Astravia: layers, keyframes, 3D camera and lights, effects and the render queue. Use when the task is motion graphics, an animated title, a visual effect, or rendering a frame range.",
      intro:
        "EffectCraft is a motion-graphics and visual-effects compositor. The tab runs upstream's own web build unmodified; upstream cannot open After Effects project files, and this plugin does not add that — it adds the doorway so a workspace file can be opened and rendered output saved back.",
    },
    detail: {
      en: {
        heroTitle: "EffectCraft in the activity panel",
        eyebrow: "Motion graphics",
        heroDescription:
          "Compositions, keyframes and a render queue — the upstream EffectCraft compositor running inside Astravia, on your own machine, with the project you opened in the workspace.",
        badges: ["No fork", "Local", "WebGPU"],
        showcase: {
          canvas: "generic",
          user: "Open titles.ecraft here.",
          assistant: "EffectCraft is open. Select the file in the Explorer, then press Open — it takes that file.",
        },
        features: [
          {
            title: "The real compositor",
            description:
              "The panel serves the official EffectCraft web build byte for byte. Upstream's wasm and JavaScript are not patched; only two thin files of ours are added around them.",
            icon: "solar:video-frame-play-horizontal-linear",
          },
          {
            title: "Open and render through the workspace",
            description:
              "Opening uses the file selected in the Explorer, and rendered output is written back through Astravia instead of a downloads folder.",
            icon: "solar:folder-with-files-linear",
          },
          {
            title: "Ask for a frame",
            description:
              "A capture tool saves a PNG of what the canvas shows right now, so a composition can be checked from the conversation.",
            icon: "solar:chat-round-linear",
          },
        ],
        steps: [
          {
            title: "Install the plugin",
            description:
              "About 22 MB of editor files arrive on first open and are reused offline after that — no GPU driver, Node or native app to install.",
          },
          {
            title: "Open the EffectCraft tab",
            description:
              "The editor needs a WebGPU adapter. On a machine without one it fails at startup and the tab says so instead of showing a blank frame.",
          },
          {
            title: "Select a project, then open it",
            description: "File → Open inside the editor takes the file selected in Astravia rather than a system dialog.",
          },
          {
            title: "Render, then save through the workspace",
            description: "Rendered output travels the same bridge as a save, so it lands where you chose.",
          },
        ],
        callouts: [
          {
            tone: "warning",
            content:
              "This build renders through WebGPU. Without an adapter the editor cannot start, and the panel reports the boot failure — it does not retry in software.",
          },
          {
            tone: "info",
            content:
              "Upstream cannot open After Effects project files. Compositions are built in EffectCraft itself; the browser entry points also have no workspace binding.",
          },
        ],
        links: [
          { label: "EffectCraft on GitHub", href: "https://github.com/storytold/effectcraft" },
          { label: "EffectCraft releases", href: "https://github.com/storytold/effectcraft/releases" },
        ],
      },
      zh: {
        heroTitle: "在活动面板里用 EffectCraft",
        eyebrow: "动态图形",
        heroDescription:
          "合成、关键帧与渲染队列——上游原版 EffectCraft 合成器跑在 Astravia 里，打开的就是工作区里的那个工程。",
        badges: ["不改上游", "本地运行", "WebGPU"],
        showcase: {
          canvas: "generic",
          user: "在这里打开 titles.ecraft。",
          assistant: "EffectCraft 已打开。在资源管理器选中文件，再点打开，它会直接用这个文件。",
        },
        features: [
          {
            title: "原版合成器",
            description:
              "面板逐字节送出 EffectCraft 官方 web 构建；上游 wasm 与 JavaScript 不打补丁，我们只在其外围加了两个薄文件。",
            icon: "solar:video-frame-play-horizontal-linear",
          },
          {
            title: "在项目里打开与渲染",
            description: "打开用资源管理器选中的文件，渲染结果经 Astravia 写回，不落到下载文件夹。",
            icon: "solar:folder-with-files-linear",
          },
          {
            title: "随时要一帧看看",
            description: "截图工具把画布当前画面存成 PNG，在对话里就能核对合成效果。",
            icon: "solar:chat-round-linear",
          },
        ],
        steps: [
          {
            title: "安装插件",
            description: "首次打开时下载约 22 MB 编辑器文件，之后离线复用；不需要装 GPU 驱动、Node 或桌面应用。",
          },
          {
            title: "打开 EffectCraft 标签页",
            description: "编辑器需要可用的 WebGPU 适配器；没有的话启动就会失败，面板会如实报错，而不是给一张白屏。",
          },
          {
            title: "选中工程再打开",
            description: "在编辑器里按「文件 → 打开」，用的是 Astravia 里选中的文件，而不是系统对话框。",
          },
          {
            title: "渲染后经工作区保存",
            description: "渲染结果走与保存相同的桥，落在你选的位置。",
          },
        ],
        callouts: [
          {
            tone: "warning",
            content: "这个构建走 WebGPU 渲染。没有适配器时编辑器无法启动，面板会报出启动失败，不会退回软件渲染重试。",
          },
          {
            tone: "info",
            content:
              "上游打不开 After Effects 工程文件，合成要在 EffectCraft 里搭；浏览器入口同样没有工作区绑定。",
          },
        ],
        links: [
          { label: "EffectCraft 源码", href: "https://github.com/storytold/effectcraft" },
          { label: "EffectCraft 版本发布", href: "https://github.com/storytold/effectcraft/releases" },
        ],
      },
    },
  },

  {
    id: "filmcraft",
    name: "FilmCraft",
    tabLabel: "FilmCraft",
    tabOrder: 19,
    pluginVersion: "0.0.1",
    serviceId: "filmcraft-hub",
    repo: "https://github.com/storytold/filmcraft",
    license: "MIT OR Apache-2.0",
    category: "Media",
    tags: ["video-editing", "nle", "timeline", "color", "audio"],
    tagsZh: ["视频剪辑", "时间线", "调色", "声音"],
    summary:
      "Cut video on a real timeline inside Astravia — the upstream FilmCraft non-linear editor with colour, sound and a WebGL fallback for machines without WebGPU.",
    summaryZh:
      "在 Astravia 里剪片子：真实时间线、调色与声音，用的是上游原版 FilmCraft 剪辑器，没有 WebGPU 的机器会自动退回 WebGL。",
    payload: {
      version: "0.16.0",
      size: 15097399,
      sha256: "79da0f879f86f4520c1721d8296dfa61220c33eb0e39bf8e58fd883388800431",
      localFile: "filmcraft-web-0.16.0.zip",
      sizeLabel: "15 MB",
    },
    seed: null,
    nosw: false,
    docs: { kind: "flat", path: "docs" },
    skill: {
      alias: "FilmCraft 视频剪辑",
      description:
        "Edit video in FilmCraft inside Astravia: a non-linear timeline, clips, colour, and sound. Use when the task is cutting, trimming or assembling video, or when a project has to be opened from the workspace and rendered back.",
      intro:
        "FilmCraft is a non-linear video editor with colour and sound. The tab runs upstream's own web build unmodified; upstream falls back from WebGPU to WebGL by reloading with a flag, and the hub passes that flag through untouched.",
    },
    detail: {
      en: {
        heroTitle: "FilmCraft in the activity panel",
        eyebrow: "Video editing",
        heroDescription:
          "A timeline, clips, colour and sound — the upstream FilmCraft editor running inside Astravia, on your own machine, with the project you opened in the workspace.",
        badges: ["No fork", "Local", "WebGL fallback"],
        showcase: {
          canvas: "generic",
          user: "Open cut.filmcraft here.",
          assistant: "FilmCraft is open. Select the file in the Explorer, then press Open — it takes that file.",
        },
        features: [
          {
            title: "The real editor",
            description:
              "The panel serves the official FilmCraft web build byte for byte. Upstream's wasm and JavaScript are not patched; only two thin files of ours are added around them.",
            icon: "solar:clapperboard-edit-linear",
          },
          {
            title: "Open and render through the workspace",
            description:
              "Opening uses the file selected in the Explorer, and whatever the editor hands back is written through Astravia instead of a downloads folder.",
            icon: "solar:folder-with-files-linear",
          },
          {
            title: "It retries rendering instead of giving up",
            description:
              "If WebGPU is unavailable the tab reloads the page with upstream's own WebGL flag, then software, before it reports a failure.",
            icon: "solar:refresh-square-linear",
          },
        ],
        steps: [
          {
            title: "Install the plugin",
            description: "About 15 MB of editor files arrive on first open and are reused offline after that.",
          },
          {
            title: "Open the FilmCraft tab",
            description: "The preparation screen is the hub fetching its payload; later opens start from cache.",
          },
          {
            title: "Select a project, then open it",
            description: "File → Open inside the editor takes the file selected in Astravia rather than a system dialog.",
          },
          {
            title: "Render back through the workspace",
            description: "Output travels the same bridge as a save, so it lands where you chose.",
          },
        ],
        callouts: [
          {
            tone: "info",
            content:
              "Upstream reloads itself with a flag when it has to drop from WebGPU to WebGL; the tab survives that reload and reports which backend is active in the status line.",
          },
          {
            tone: "info",
            content:
              "The browser entry points have no workspace binding: opening a file there uses the browser's picker and output downloads through the browser.",
          },
        ],
        links: [
          { label: "FilmCraft on GitHub", href: "https://github.com/storytold/filmcraft" },
          { label: "FilmCraft releases", href: "https://github.com/storytold/filmcraft/releases" },
        ],
      },
      zh: {
        heroTitle: "在活动面板里用 FilmCraft",
        eyebrow: "视频剪辑",
        heroDescription:
          "时间线、素材、调色与声音——上游原版 FilmCraft 剪辑器跑在 Astravia 里，打开的就是工作区里的那个工程。",
        badges: ["不改上游", "本地运行", "可退 WebGL"],
        showcase: {
          canvas: "generic",
          user: "在这里打开 cut.filmcraft。",
          assistant: "FilmCraft 已打开。在资源管理器选中文件，再点打开，它会直接用这个文件。",
        },
        features: [
          {
            title: "原版剪辑器",
            description:
              "面板逐字节送出 FilmCraft 官方 web 构建；上游 wasm 与 JavaScript 不打补丁，我们只在其外围加了两个薄文件。",
            icon: "solar:clapperboard-edit-linear",
          },
          {
            title: "在项目里打开与输出",
            description: "打开用资源管理器选中的文件，编辑器交回的字节经 Astravia 写回，不落到下载文件夹。",
            icon: "solar:folder-with-files-linear",
          },
          {
            title: "不行就换后端重试",
            description: "WebGPU 不可用时，标签页会带上游自己的 WebGL 参数重载，再不行才退软件渲染，最后才报失败。",
            icon: "solar:refresh-square-linear",
          },
        ],
        steps: [
          {
            title: "安装插件",
            description: "首次打开时下载约 15 MB 编辑器文件，之后离线复用。",
          },
          {
            title: "打开 FilmCraft 标签页",
            description: "准备页就是 hub 在取 payload；之后从缓存启动。",
          },
          {
            title: "选中工程再打开",
            description: "在编辑器里按「文件 → 打开」，用的是 Astravia 里选中的文件，而不是系统对话框。",
          },
          {
            title: "输出同样走工作区",
            description: "输出走与保存相同的桥，落在你选的位置。",
          },
        ],
        callouts: [
          {
            tone: "info",
            content:
              "上游从 WebGPU 降级到 WebGL 时会自己带参数重载；标签页能扛住这次重载，并在状态条里说明当前用的是哪个后端。",
          },
          {
            tone: "info",
            content: "浏览器入口没有工作区绑定：那里打开文件走浏览器选择框，输出走浏览器下载。",
          },
        ],
        links: [
          { label: "FilmCraft 源码", href: "https://github.com/storytold/filmcraft" },
          { label: "FilmCraft 版本发布", href: "https://github.com/storytold/filmcraft/releases" },
        ],
      },
    },
  },

  {
    id: "lightcraft",
    name: "LightCraft",
    tabLabel: "LightCraft",
    tabOrder: 20,
    pluginVersion: "0.0.1",
    serviceId: "lightcraft-hub",
    repo: "https://github.com/storytold/lightcraft",
    license: "MIT OR Apache-2.0",
    category: "Media",
    tags: ["photo-library", "raw", "lightroom", "develop", "photography"],
    tagsZh: ["照片库", "RAW", "显影", "摄影"],
    summary:
      "Browse a photo library and develop raw files inside Astravia — the upstream LightCraft catalog and darkroom, with camera raw and DNG support.",
    summaryZh:
      "在 Astravia 里管理照片库、显影 RAW：上游原版 LightCraft 的目录与暗房，支持相机 RAW 与 DNG。",
    payload: {
      version: "0.17.0",
      size: 73311887,
      sha256: "24df2d75857846ae3114293f3bef99a7b0fc83f09d329f178a76490622d389c0",
      localFile: "lightcraft-web-0.17.0.zip",
      sizeLabel: "70 MB",
    },
    seed: null,
    nosw: false,
    docs: { kind: "user", path: "docs/user" },
    skill: {
      alias: "LightCraft 照片库与显影",
      description:
        "Catalog photos and develop raw files in LightCraft inside Astravia: import, cull, grade, and export. Use when the task is photo selection, raw development, or a batch of images that needs consistent treatment.",
      intro:
        "LightCraft is a photo library and raw developer — the open-source alternative to Lightroom. The tab runs upstream's own web build unmodified; the payload is large because it carries the Chinese UI font and the raw pipeline.",
    },
    detail: {
      en: {
        heroTitle: "LightCraft in the activity panel",
        eyebrow: "Photo library",
        heroDescription:
          "A catalog and a darkroom — the upstream LightCraft raw developer running inside Astravia, on your own machine, with the images you opened in the workspace.",
        badges: ["No fork", "Local", "RAW"],
        showcase: {
          canvas: "generic",
          user: "Open shot.cr3 here.",
          assistant: "LightCraft is open. Select the file in the Explorer, then press Open — it takes that file.",
        },
        features: [
          {
            title: "The real darkroom",
            description:
              "The panel serves the official LightCraft web build byte for byte. Upstream's wasm and JavaScript are not patched; only two thin files of ours are added around them.",
            icon: "solar:camera-linear",
          },
          {
            title: "Open and export through the workspace",
            description:
              "Opening uses the file selected in the Explorer, and exports are written back through Astravia instead of a downloads folder.",
            icon: "solar:folder-with-files-linear",
          },
          {
            title: "A large first download, once",
            description:
              "The payload is about 70 MB — the editor, its raw pipeline and a CJK interface font. It is fetched once into the plugin's data directory and reused offline.",
            icon: "solar:cloud-download-linear",
          },
        ],
        steps: [
          {
            title: "Install the plugin",
            description: "Nothing else to install: no desktop app, no camera codec pack, no account.",
          },
          {
            title: "Open the LightCraft tab and let it fetch",
            description:
              "The first open downloads about 70 MB. The preparation screen reports progress; later opens start from cache.",
          },
          {
            title: "Select an image, then open it",
            description: "File → Open inside the editor takes the file selected in Astravia rather than a system dialog.",
          },
          {
            title: "Export back through the workspace",
            description: "Developed output travels the same bridge as a save, so it lands where you chose.",
          },
        ],
        callouts: [
          {
            tone: "warning",
            content:
              "The first open is a 70 MB download and the wasm module is large; on a slow connection expect a visible wait before the editor appears. This is the upstream build, not an extra package of ours.",
          },
          {
            tone: "info",
            content:
              "The browser entry points have no workspace binding: opening a file there uses the browser's picker and exports download through the browser.",
          },
        ],
        links: [
          { label: "LightCraft on GitHub", href: "https://github.com/storytold/lightcraft" },
          { label: "LightCraft releases", href: "https://github.com/storytold/lightcraft/releases" },
        ],
      },
      zh: {
        heroTitle: "在活动面板里用 LightCraft",
        eyebrow: "照片库",
        heroDescription:
          "一个目录加一间暗房——上游原版 LightCraft 显影器跑在 Astravia 里，打开的就是工作区里的那些照片。",
        badges: ["不改上游", "本地运行", "RAW"],
        showcase: {
          canvas: "generic",
          user: "在这里打开 shot.cr3。",
          assistant: "LightCraft 已打开。在资源管理器选中文件，再点打开，它会直接用这个文件。",
        },
        features: [
          {
            title: "原版暗房",
            description:
              "面板逐字节送出 LightCraft 官方 web 构建；上游 wasm 与 JavaScript 不打补丁，我们只在其外围加了两个薄文件。",
            icon: "solar:camera-linear",
          },
          {
            title: "在项目里打开与导出",
            description: "打开用资源管理器选中的文件，导出经 Astravia 写回，不落到下载文件夹。",
            icon: "solar:folder-with-files-linear",
          },
          {
            title: "首次下载大一些，只有一次",
            description:
              "payload 约 70 MB：编辑器、RAW 处理链和一套中文字体。首次取到插件数据目录后，之后离线复用。",
            icon: "solar:cloud-download-linear",
          },
        ],
        steps: [
          {
            title: "安装插件",
            description: "不需要再装桌面应用、相机编码包或注册账号。",
          },
          {
            title: "打开 LightCraft 标签页等它取文件",
            description: "首次打开会下载约 70 MB，准备页会显示进度；之后从缓存启动。",
          },
          {
            title: "选中照片再打开",
            description: "在编辑器里按「文件 → 打开」，用的是 Astravia 里选中的文件，而不是系统对话框。",
          },
          {
            title: "导出同样走工作区",
            description: "显影结果走与保存相同的桥，落在你选的位置。",
          },
        ],
        callouts: [
          {
            tone: "warning",
            content:
              "首次打开要下 70 MB，wasm 模块也大；网络慢时会明显等一会儿才出现界面。这是上游构建本身，不是我们额外加的包。",
          },
          {
            tone: "info",
            content: "浏览器入口没有工作区绑定：那里打开文件走浏览器选择框，导出走浏览器下载。",
          },
        ],
        links: [
          { label: "LightCraft 源码", href: "https://github.com/storytold/lightcraft" },
          { label: "LightCraft 版本发布", href: "https://github.com/storytold/lightcraft/releases" },
        ],
      },
    },
  },

  {
    id: "pdfcraft",
    name: "PDFCraft",
    tabLabel: "PDFCraft",
    tabOrder: 21,
    pluginVersion: "0.0.1",
    serviceId: "pdfcraft-hub",
    repo: "https://github.com/storytold/pdfcraft",
    license: "MIT OR Apache-2.0",
    category: "Documents",
    tags: ["pdf", "reader", "merge", "split", "encryption"],
    tagsZh: ["PDF", "阅读器", "合并", "拆分", "加密"],
    summary:
      "Read and rearrange PDFs inside Astravia — the upstream PDFCraft workbench for merging, splitting, rotating and securing documents, with no account and no telemetry.",
    summaryZh:
      "在 Astravia 里读 PDF、重排页面：上游原版 PDFCraft 工作台，可合并、拆分、旋转与加密，不需要账号，也不上报数据。",
    payload: {
      version: "0.17.0",
      size: 17417347,
      sha256: "393420ab35e25afc174cb6d1791098bb714099aca91cf6598b4553e57c48a835",
      localFile: "pdfcraft-web-0.17.0.zip",
      sizeLabel: "17 MB",
    },
    seed: null,
    nosw: false,
    docs: { kind: "flat", path: "docs" },
    skill: {
      alias: "PDFCraft PDF 工作台",
      description:
        "Work on PDFs in PDFCraft inside Astravia: read, reorder, merge, split, rotate and secure documents. Use when the task is assembling or fixing a PDF, extracting pages, or applying encryption.",
      intro:
        "PDFCraft is a PDF reader and editor. The tab runs upstream's own web build unmodified; the plugin adds the doorway so a PDF in the workspace can be opened and the resulting bytes written back.",
    },
    detail: {
      en: {
        heroTitle: "PDFCraft in the activity panel",
        eyebrow: "PDF workbench",
        heroDescription:
          "Read, reorder, merge, split and secure — the upstream PDFCraft workbench running inside Astravia, on your own machine, with the document you opened in the workspace.",
        badges: ["No fork", "Local", "No account"],
        showcase: {
          canvas: "docs",
          user: "Open contract.pdf here.",
          assistant: "PDFCraft is open. Select the file in the Explorer, then press Open — it takes that file.",
        },
        features: [
          {
            title: "The real workbench",
            description:
              "The panel serves the official PDFCraft web build byte for byte. Upstream's wasm and JavaScript are not patched; only two thin files of ours are added around them.",
            icon: "solar:document-text-linear",
          },
          {
            title: "Open and save inside your project",
            description:
              "Opening uses the file selected in the Explorer, and results are written back through Astravia instead of a downloads folder.",
            icon: "solar:folder-with-files-linear",
          },
          {
            title: "Nothing leaves the machine",
            description:
              "The document is parsed locally in the tab. There is no account, no upload and no telemetry — the only network traffic is the one-time editor download.",
            icon: "solar:shield-check-linear",
          },
        ],
        steps: [
          {
            title: "Install the plugin",
            description: "About 17 MB of editor files arrive on first open and are reused offline after that.",
          },
          {
            title: "Open the PDFCraft tab",
            description: "The preparation screen is the hub fetching its payload; later opens start from cache.",
          },
          {
            title: "Select a PDF, then open it",
            description: "File → Open inside the editor takes the file selected in Astravia rather than a system dialog.",
          },
          {
            title: "Save the result back",
            description: "The output goes through Astravia, so it can replace the source or become a new file.",
          },
        ],
        callouts: [
          {
            tone: "info",
            content:
              "Encryption and page operations happen in the browser sandbox, on your machine. A password you type is handled by upstream's code, never sent to the plugin's hub.",
          },
          {
            tone: "info",
            content:
              "The browser entry points have no workspace binding: opening a file there uses the browser's picker and output downloads through the browser.",
          },
        ],
        links: [
          { label: "PDFCraft on GitHub", href: "https://github.com/storytold/pdfcraft" },
          { label: "PDFCraft releases", href: "https://github.com/storytold/pdfcraft/releases" },
        ],
      },
      zh: {
        heroTitle: "在活动面板里用 PDFCraft",
        eyebrow: "PDF 工作台",
        heroDescription:
          "读、重排、合并、拆分、加密——上游原版 PDFCraft 工作台跑在 Astravia 里，打开的就是工作区里的那份文档。",
        badges: ["不改上游", "本地运行", "免账号"],
        showcase: {
          canvas: "docs",
          user: "在这里打开 contract.pdf。",
          assistant: "PDFCraft 已打开。在资源管理器选中文件，再点打开，它会直接用这个文件。",
        },
        features: [
          {
            title: "原版工作台",
            description:
              "面板逐字节送出 PDFCraft 官方 web 构建；上游 wasm 与 JavaScript 不打补丁，我们只在其外围加了两个薄文件。",
            icon: "solar:document-text-linear",
          },
          {
            title: "在项目里打开与保存",
            description: "打开用资源管理器选中的文件，结果经 Astravia 写回，不落到下载文件夹。",
            icon: "solar:folder-with-files-linear",
          },
          {
            title: "文件不出本机",
            description:
              "文档在标签页里本地解析，没有账号、没有上传、没有遥测；唯一一次联网是取编辑器文件。",
            icon: "solar:shield-check-linear",
          },
        ],
        steps: [
          {
            title: "安装插件",
            description: "首次打开时下载约 17 MB 编辑器文件，之后离线复用。",
          },
          {
            title: "打开 PDFCraft 标签页",
            description: "准备页就是 hub 在取 payload；之后从缓存启动。",
          },
          {
            title: "选中 PDF 再打开",
            description: "在编辑器里按「文件 → 打开」，用的是 Astravia 里选中的文件，而不是系统对话框。",
          },
          {
            title: "把结果存回去",
            description: "输出经 Astravia 写回，可以覆盖原文件，也可以另存为新文件。",
          },
        ],
        callouts: [
          {
            tone: "info",
            content: "加密与页面操作都在浏览器沙箱里、在本机完成；你输入的密码由上游代码处理，不会发到插件的 hub。",
          },
          {
            tone: "info",
            content: "浏览器入口没有工作区绑定：那里打开文件走浏览器选择框，输出走浏览器下载。",
          },
        ],
        links: [
          { label: "PDFCraft 源码", href: "https://github.com/storytold/pdfcraft" },
          { label: "PDFCraft 版本发布", href: "https://github.com/storytold/pdfcraft/releases" },
        ],
      },
    },
  },

  {
    id: "vectorcraft",
    name: "VectorCraft",
    tabLabel: "VectorCraft",
    tabOrder: 22,
    pluginVersion: "0.0.1",
    serviceId: "vectorcraft-hub",
    repo: "https://github.com/storytold/vectorcraft",
    license: "MIT OR Apache-2.0",
    category: "Design",
    tags: ["vector", "illustration", "svg", "bezier", "design"],
    tagsZh: ["矢量", "插画", "SVG", "贝塞尔"],
    summary:
      "Draw and edit vectors inside Astravia — the upstream VectorCraft illustration app with bezier paths, fills and SVG output.",
    summaryZh:
      "在 Astravia 里画矢量、改路径：上游原版 VectorCraft 插画应用，贝塞尔曲线、填充与 SVG 输出。",
    payload: {
      version: "0.20.0",
      size: 32438720,
      sha256: "47c98c485ec149426cb055c1875e6535a88db7e91edb81f85a91596f34e9d101",
      localFile: "vectorcraft-web-0.20.0.zip",
      sizeLabel: "31 MB",
    },
    seed: null,
    nosw: false,
    docs: { kind: "flat", path: "docs" },
    skill: {
      alias: "VectorCraft 矢量插画",
      description:
        "Draw vector artwork in VectorCraft inside Astravia: paths, bezier handles, fills, strokes and SVG output. Use when the task is a logo, an icon, a diagram or any illustration that has to stay sharp at every size.",
      intro:
        "VectorCraft is a vector illustration application. The tab runs upstream's own web build unmodified; this plugin adds the doorway so a drawing in the workspace can be opened and the SVG it produces written back.",
    },
    detail: {
      en: {
        heroTitle: "VectorCraft in the activity panel",
        eyebrow: "Vector illustration",
        heroDescription:
          "Paths, handles and fills — the upstream VectorCraft illustration app running inside Astravia, on your own machine, with the drawing you opened in the workspace.",
        badges: ["No fork", "Local", "SVG"],
        showcase: {
          canvas: "design",
          user: "Open logo.svg here.",
          assistant: "VectorCraft is open. Select the file in the Explorer, then press Open — it takes that file.",
        },
        features: [
          {
            title: "The real illustration app",
            description:
              "The panel serves the official VectorCraft web build byte for byte. Upstream's wasm and JavaScript are not patched; only two thin files of ours are added around them.",
            icon: "solar:pen-new-square-linear",
          },
          {
            title: "Open and save inside your project",
            description:
              "Opening uses the file selected in the Explorer, and output is written back through Astravia instead of a downloads folder.",
            icon: "solar:folder-with-files-linear",
          },
          {
            title: "Ask for the current canvas",
            description:
              "A capture tool saves a PNG of what the canvas shows right now, so a drawing can be reviewed from the conversation.",
            icon: "solar:chat-round-linear",
          },
        ],
        steps: [
          {
            title: "Install the plugin",
            description:
              "About 31 MB of editor files arrive on first open — including the layout fonts — and are reused offline after that.",
          },
          {
            title: "Open the VectorCraft tab",
            description: "The preparation screen is the hub fetching its payload; later opens start from cache.",
          },
          {
            title: "Select a drawing, then open it",
            description: "File → Open inside the editor takes the file selected in Astravia rather than a system dialog.",
          },
          {
            title: "Save the result back",
            description: "The output goes through Astravia, so it can replace the source or become a new file.",
          },
        ],
        callouts: [
          {
            tone: "info",
            content:
              "Upstream ships an MCP server for scripted work; this plugin does not start it. In the tab, use the Agent tools that are listed in the skill — they talk to the running page.",
          },
          {
            tone: "info",
            content:
              "The browser entry points have no workspace binding: opening a file there uses the browser's picker and output downloads through the browser.",
          },
        ],
        links: [
          { label: "VectorCraft on GitHub", href: "https://github.com/storytold/vectorcraft" },
          { label: "VectorCraft releases", href: "https://github.com/storytold/vectorcraft/releases" },
        ],
      },
      zh: {
        heroTitle: "在活动面板里用 VectorCraft",
        eyebrow: "矢量插画",
        heroDescription:
          "路径、控制柄、填充——上游原版 VectorCraft 插画应用跑在 Astravia 里，打开的就是工作区里的那张图。",
        badges: ["不改上游", "本地运行", "SVG"],
        showcase: {
          canvas: "design",
          user: "在这里打开 logo.svg。",
          assistant: "VectorCraft 已打开。在资源管理器选中文件，再点打开，它会直接用这个文件。",
        },
        features: [
          {
            title: "原版插画应用",
            description:
              "面板逐字节送出 VectorCraft 官方 web 构建；上游 wasm 与 JavaScript 不打补丁，我们只在其外围加了两个薄文件。",
            icon: "solar:pen-new-square-linear",
          },
          {
            title: "在项目里打开与保存",
            description: "打开用资源管理器选中的文件，结果经 Astravia 写回，不落到下载文件夹。",
            icon: "solar:folder-with-files-linear",
          },
          {
            title: "随时要一张当前画面",
            description: "截图工具把画布当前画面存成 PNG，在对话里就能审图。",
            icon: "solar:chat-round-linear",
          },
        ],
        steps: [
          {
            title: "安装插件",
            description: "首次打开时下载约 31 MB（含排版字体），之后离线复用。",
          },
          {
            title: "打开 VectorCraft 标签页",
            description: "准备页就是 hub 在取 payload；之后从缓存启动。",
          },
          {
            title: "选中图形再打开",
            description: "在编辑器里按「文件 → 打开」，用的是 Astravia 里选中的文件，而不是系统对话框。",
          },
          {
            title: "把结果存回去",
            description: "输出经 Astravia 写回，可以覆盖原文件，也可以另存为新文件。",
          },
        ],
        callouts: [
          {
            tone: "info",
            content:
              "上游自带一个 MCP server 供脚本调用，本插件不启用它。标签页里请用技能中列出的 Agent 工具，它们直接与运行中的页面通信。",
          },
          {
            tone: "info",
            content: "浏览器入口没有工作区绑定：那里打开文件走浏览器选择框，输出走浏览器下载。",
          },
        ],
        links: [
          { label: "VectorCraft 源码", href: "https://github.com/storytold/vectorcraft" },
          { label: "VectorCraft 版本发布", href: "https://github.com/storytold/vectorcraft/releases" },
        ],
      },
    },
  },
];
