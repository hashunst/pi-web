# Pi SDK — راهنمای کامل اتوماسیون

بر اساس مستند رسمی [pi.dev/docs/latest/sdk](https://pi.dev/docs/latest/sdk) (نسخهٔ محلی: `node_modules/@earendil-works/pi-coding-agent/docs/sdk.md` و مثال‌های `examples/sdk/`)

SDK روی `@earendil-works/pi-coding-agent` (پکیج اصلی؛ نصب جدا لازم نیست) ساخته می‌شود:

```bash
npm install @earendil-works/pi-coding-agent
```

## نقشهٔ کلی: چه قابلیت‌هایی برای اتوماسیون داری؟

| # | قابلیت | API کلیدی | کاربرد در اتوماسیون |
|---|--------|-----------|---------------------|
| 1 | اجرای یک‌بار (one-shot) | `createAgentSession`, `session.prompt` | لایتنر اسکریپت‌ها، CI/CD |
| 2 | استریم و گزارش پیشرفت | `session.subscribe` + Events | نمایش زنده، لاگ ساختاریافته |
| 3 | هدایت حین اجرا | `session.steer`, `session.followUp` | تغییر مسیر بدون توقف |
| 4 | ابزارهای سفارشی | `defineTool`, `customTools` | اتصال به API/DB/سیستم‌های داخلی |
| 5 | مدیریت ابزارهای داخلی | `tools`, `excludeTools`, `noTools` | حالت read-only / محدود |
| 6 | انتخاب مدل | `ModelRuntime`, `getModel`, `thinkingLevel`, `scopedModels` | مدیریت هزینه/کیفیت |
| 7 | احراز هویت | `ModelRuntime`, `auth.json`, env keys | CI/CD بدون کلید روی دیسک |
| 8 | System Prompt | `systemPromptOverride`, `appendSystemPromptOverride` | رفتار ثابت برای پایپ‌لاین |
| 9 | اکستنشن‌ها | `extensionFactories`, `pi.on`, `eventBus` | ممیزی، block کردن ابزار، audit log |
| 10 | Skills | `skillsOverride` | تزریق دستورالعمل‌های تخصصی |
| 11 | فایل‌های زمینه | `agentsFilesOverride` (AGENTS.md) | قواعد پروژه بدون فایل فیزیکی |
| 12 | Slash commands | `promptsOverride` (PromptTemplate) | کامندهای قابل‌اتوماسیون |
| 13 | Settings | `SettingsManager` | غیرفعال‌کردن compaction/retry و… |
| 14 | Session | `SessionManager` | persistence، resume، fork، tree |
| 15 | جایگزینی session | `AgentSessionRuntime` | new / switch / fork / clone / import |
| 16 | Compaction | `session.compact`, `navigateTree` | مدیریت context در اجراهای بلند |
| 17 | تصویر | `session.prompt(text, { images }) | | vision / بررسی اسکرین‌شات |
| 18 | قطع اجرای در حال‌عمل | `session.abort`, `waitForIdle` | timeout / kill |
| 19 | Preflight | `prompt({ preflightResult })` | رد/قبول قبل از شروع |
| 20 | Run modes | `InteractiveMode`, `runPrintMode`, `runRpcMode` | TUI / CLI / JSON-RPC |
| 21 | چند پروژه | `cwd` + `SessionManager.inMemory(cwd)` | fan-out روی چند repo |
| 22 | Tool factories | `createCodingTools`, `createReadOnlyTools` | استفاده از ابزارها خارج از session |

---

## ۱. ساده‌ترین اتوماسیون: یک‌بار اجرا و خروجی

```typescript
import { createAgentSession } from "@earendil-works/pi-coding-agent";

const { session } = await createAgentSession();

session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

// prompt فقط بعد از اتمام کامل اجرا (شامل retryها) resolve می‌شود
await session.prompt("فایل‌های دایرکتوری فعلی را لیست کن و خلاصه‌ای بنویس.");

session.dispose(); // همیشه در finally
```

مدل: اگر ندهی → (۱) restore از session قبلی، (۲) پیش‌فرض settings، (۳) اولین مدل available.

## ۲. رویدادها (Events): قلب گزارش‌دهی اتوماسیون

`session.subscribe(listener)` → تابع unsubscribe برمی‌گرداند.

```typescript
session.subscribe((event) => {
  switch (event.type) {
    // ── استریم متن/تفکر از مدل ──
    case "message_update":
      if (event.assistantMessageEvent.type === "text_delta") {
        process.stdout.write(event.assistantMessageEvent.delta);
      }
      if (event.assistantMessageEvent.type === "thinking_delta") {
        // خروجی thinking (اگر thinking روشن باشد)
      }
      break;

    // ── اجرای ابزارها ──
    case "tool_execution_start":
      console.log(`⏳ ابزار: ${event.toolName}`);
      break;
    case "tool_execution_update":
      // خروجی استریم‌شدهٔ ابزار
      break;
    case "tool_execution_end":
      console.log(`✅ ${event.toolName}: ${event.isError ? "خطا" : "موفق"}`);
      break;

    // ── چرخهٔ پیام ──
    case "message_start": break;
    case "message_end": break;

    // ── چرخهٔ turn (یک پاسخ LLM + tool calls آن) ──
    case "turn_start": break;
    case "turn_end":
      // event.message: پاسخ assistant
      // event.toolResults: نتایج ابزارهای این turn
      break;

    // ── چرخهٔ agent ──
    case "agent_start": break;
    case "agent_end":
      // event.messages: پیام‌های جدید
      break;

    // ── رویدادهای session ──
    case "queue_update":
      console.log(`صف: ${event.steering.length} steer, ${event.followUp.length} followUp`);
      break;
    case "compaction_start":
    case "compaction_end":
    case "auto_retry_start":
    case "auto_retry_end":
    case "summarization_retry_scheduled":
    case "summarization_retry_attempt_start":
    case "summarization_retry_finished":
      break;
  }
});
```

**پن‌رن‌های اتوماسیون:**
- برای **audit log**: `tool_execution_start`/`tool_execution_end` را با `toolName` و `isError` بنویس در فایل/DB.
- برای **تأیید کار انجام‌شده**: در `agent_end` از `event.messages` یا `session.agent.state.messages` آخرین پیام assistant را بخوان.
- اشتباهات بعد از accept از طریق همین event/message stream گزارش می‌شوند (نه `preflightResult`).

## ۳. هدایت حین اجرا: steer / followUp / queue

```typescript
await session.prompt("کلین‌آپ کد را شروع کن");

// steer: بعد از تمام‌شدن tool calls فعلی تحویل می‌شود (بدون انتظار برای توقف)
await session.steer("خیر، فقط فایل‌های TypeScript را لمس کن");

// followUp: فقط وقتی agent کامل توقف کرد تحویل می‌شود
await session.followUp("بعد از تمام‌شدن، آمار تغییرات را بده");
```

- `prompt()` **حین streaming** بدون `streamingBehavior` خطا می‌دهد:
  ```typescript
  await session.prompt("بازگردان؛ این را بکن", { streamingBehavior: "steer" });
  await session.prompt("بعداً X را هم چک کن", { streamingBehavior: "followUp" });
  ```
- `steer()` و `followUp()` فایل‌های prompt template را expand می‌کنند ولی **extension command** نمی‌پذیرند (queue نمی‌شوند).
- **Extension commandها** (مثل `/deploy`) حتی حین streaming **فوری** اجرا می‌شوند؛ خودشان با `pi.sendMessage()` با LLM صحبت می‌کنند.

### Preflight (قبول/رد قبل از شروع)

```typescript
const accepted = await new Promise<boolean>((resolve) => {
  session.prompt("کامپایل کن", {
    preflightResult: (ok) => resolve(ok),
  }).then(() => {}); // promise اصلی بعد از اتمام کامل resolve می‌شود
});
// true  → accepted/queued/immediate
// false → preflight رد کرد (قبل از acceptance)
```

## ۴. ابزارهای سفارشی (defineTool) — اتصال به سیستم‌های داخلی

```typescript
import { Type } from "typebox";
import { createAgentSession, defineTool } from "@earendil-works/pi-coding-agent";

const deployTool = defineTool({
  name: "deploy",
  label: "Deploy",
  description: "اپلیکیشن را روی سرور مشخص deploy می‌کند",
  parameters: Type.Object({
    env: Type.String({ description: "target: staging | prod" }),
  }),
  execute: async (_toolCallId, params) => {
    const res = await fetch(`https://ci.example.com/api/deploy?env=${params.env}`, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.CI_TOKEN}` },
    });
    return {
      content: [{ type: "text", text: `deploy ${params.env}: ${res.status}` }],
      details: { url: res.url },
    };
  },
});

const { session } = await createAgentSession({
  // اگر tools بدهی، نام ابزار سفارشی هم باید داخلش باشد:
  tools: ["read", "bash", "deploy"],
  customTools: [deployTool],
});
```

نکته: ابزارهای extension-registered (`pi.registerTool`) هم با `customTools` ترکیب می‌شوند.

## ۵. مدیریت ابزارهای داخلی: read-only / محدود

ابزارهای داخلی: `read`, `bash`, `powershell`, `edit`, `write`, `grep`, `find`, `ls` (پیش‌فرض: read, bash, edit, write)

```typescript
// حالت read-only — ایمن برای agentهای «فقط تحلیل»
const { session: ro } = await createAgentSession({
  tools: ["read", "grep", "find", "ls"],
});

// انتخاب دستی
const { session: s1 } = await createAgentSession({ tools: ["read", "bash", "grep"] });

// PowerShell به‌جای Bash (Windows)
const { session: s2 } = await createAgentSession({ tools: ["read", "powershell", "edit", "write"] });

// حذف یک ابزار خاص بعد از apply شدن allowlist
const { session: s3 } = await createAgentSession({ excludeTools: ["ask_question"] });

// خاموش‌کردن همهٔ ابزارها
const { session: s4 } = await createAgentSession({ noTools: "all" });
// یا فقط built-inها (ابزار extension/custom می‌مانند)
const { session: s5 } = await createAgentSession({ noTools: "builtin" });
```

## ۶. انتخاب مدل و thinking

```typescript
import { getModel } from "@earendil-works/pi-ai";
import { ModelRuntime, createAgentSession } from "@earendil-works/pi-coding-agent";

const modelRuntime = await ModelRuntime.create();

const opus = getModel("anthropic", "claude-opus-4-5");
if (!opus) throw new Error("Model not found");

// مدل‌های custom از models.json:
const custom = modelRuntime.getModel("my-provider", "my-model");

// فقط مدل‌هایی که auth معتبر دارند:
const available = await modelRuntime.getAvailable();

const { session } = await createAgentSession({
  model: opus,
  thinkingLevel: "medium", // off, minimal, low, medium, high, xhigh, max
  scopedModels: [
    { model: opus, thinkingLevel: "high" },
    { model: custom!, thinkingLevel: "off" },
  ],
  modelRuntime,
});

// حین اجرا (مفید برای fallback ارزان پس از کار سنگین):
await session.setModel(custom!);
session.setThinkingLevel("off");
await session.cycleModel();        // like Ctrl+P
session.cycleThinkingLevel();
```

### حل‌کننده‌های CLI-compatible

```typescript
import { resolveCliModel, resolveModelScopeWithDiagnostics } from "@earendil-works/pi-coding-agent";

const cliModel = resolveCliModel({ cliModel: "anthropic/claude-opus-4-5:high", modelRuntime });
if (cliModel.error) throw new Error(cliModel.error);
if (cliModel.warning) console.warn(cliModel.warning);

const { scopedModels, diagnostics } = await resolveModelScopeWithDiagnostics(
  ["anthropic/*:high", "gpt-5"],
  modelRuntime,
);
```

### تازه‌کردن کاتالوگ (offline-first)

```typescript
// create() فقط کاتالوگ کش‌شده را برمی‌گرداند:
const runtime = await ModelRuntime.create({
  allowModelNetwork: true,
  modelRefreshTimeoutMs: 15_000,
});

const signal = AbortSignal.timeout(15_000);
const result = await runtime.refresh({ providers: ["anthropic"], signal });
if (result.aborted) console.warn("refresh قطع شد؛ از cache استفاده می‌کنم");
for (const [providerId, error] of result.errors) {
  console.warn(`refresh نشد ${providerId}:`, error);
}
// PI_OFFLINE=1 → دسترسی شبکهٔ model کامل قطع
```

## ۷. احراز هویت (API key / OAuth) — مهم برای CI/CD

اولویت: (۱) runtime override → (۲) `auth.json` → (۳) environment → (۴) fallback resolver.

```typescript
import { InMemoryCredentialStore } from "@earendil-works/pi-ai";
import { ModelRuntime, createAgentSession } from "@earendil-works/pi-coding-agent";

// پیش‌فرض: ~/.pi/agent/auth.json + models.json
const modelRuntime = await ModelRuntime.create();

// وضعیت auth هر provider:
for (const provider of modelRuntime.getProviders()) {
  const status = await modelRuntime.checkAuth(provider.id);
  console.log(provider.name, provider.auth, status);
}

// کلید موقت در حافظه (روی دیسک نمی‌ماند) — الگوی استاندارد CI/CD:
await modelRuntime.setRuntimeApiKey("anthropic", process.env.ANTHROPIC_API_KEY!);
await modelRuntime.removeRuntimeApiKey("anthropic");

// مسیرهای سفارشی:
const custom = await ModelRuntime.create({
  authPath: "/my/app/auth.json",
  modelsPath: "/my/app/models.json",
});

// یا store کاملاً در حافظه (test/سایبر):
const inMem = await ModelRuntime.create({
  credentials: new InMemoryCredentialStore(),
});

// catalog store: پیش‌فرض ~/.pi/agent/models-store.json
// گزینه‌ها: modelsStorePath یا تزریق modelsStore
```

اگر commit شدن credential با sync local ناموفق بماند → `CredentialSynchronizationError` (فیلدهای `providerId`, `operation`, `credential`, `cause`) — کور‌کورانه retry نکن.

## ۸. System Prompt سفارشی

```typescript
import { DefaultResourceLoader, createAgentSession } from "@earendil-works/pi-coding-agent";

// جایگزینی کامل:
const loader = new DefaultResourceLoader({
  systemPromptOverride: () => "تو یک reviewer سخت‌گیر هستی. کوتاه و دقیق باش.",
  // جلوگیری از اضافه‌شدن APPEND_SYSTEM.md از ~/.pi/agent یا <cwd>/.pi:
  appendSystemPromptOverride: () => [],
});
await loader.reload();
const { session } = await createAgentSession({ resourceLoader: loader });

// یا فقط افزودن روی prompt پیش‌فرض:
const loader2 = new DefaultResourceLoader({
  appendSystemPromptOverride: (base) => [
    ...base,
    "## قواعد ما\n- همیشه به فارسی جواب بده\n- diffها را به‌صورت unified نشان بده",
  ],
});
```

## ۹. اکستنشن‌ها: audit، block ابزار، event bus

```typescript
import {
  createEventBus,
  DefaultResourceLoader,
  createAgentSession,
  type InlineExtension,
} from "@earendil-works/pi-coding-agent";

// اکستنشن inline با نام توصیفی:
const audit: InlineExtension = {
  name: "audit",
  factory: (pi) => {
    pi.on("agent_start", () => console.log("[audit] شروع اجرا"));

    pi.on("tool_call", async (event) => {
      console.log(`[audit] tool: ${event.toolName}`);
      // block کردن ابزار خطرناک:
      if (event.toolName === "bash" && /rm -rf/.test(JSON.stringify(event))) {
        return { block: true, reason: "rm -rf در CI مجاز نیست" };
      }
      return undefined;
    });

    pi.on("agent_end", (event) => console.log(`[audit] پایان، ${event.messages.length} پیام`));

    // ابزار/کامند هم قابل ثبت است:
    pi.registerCommand("report", {
      description: "گزارش audit",
      handler: async (args, ctx) => {
        ctx.ui.notify(`report: ${args}`);
      },
    });
  },
};

// event bus مشترک (ارتباط بیرونی با اکستنشن):
const eventBus = createEventBus();
const loader = new DefaultResourceLoader({
  eventBus,
  additionalExtensionPaths: ["/path/to/my-extension.ts"],
  extensionFactories: [audit],
});
await loader.reload();

eventBus.on("my-extension:status", (data) => console.log(data));

const { session } = await createAgentSession({ resourceLoader: loader });
```

فایل اکستنشن (TS با default export):

```typescript
// ./my-logging-extension.ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event) => {
    console.log(`tool: ${event.toolName}`);
  });
  pi.registerTool({
    name: "my_tool",
    label: "My Tool",
    description: "Does something useful",
    parameters: Type.Object({ input: Type.String() }),
    execute: async (_toolCallId, params) => ({
      content: [{ type: "text", text: `Processed: ${params.input}` }],
      details: {},
    }),
  });
}
```

اکتشاف پیش‌فرض: `~/.pi/agent/extensions/`, `<cwd>/.pi/extensions/`, و آرایهٔ `extensions` در settings.json.

## ۱۰. Skills: تزریق دستورالعمل تخصصی

```typescript
import {
  createAgentSession,
  createSyntheticSourceInfo,
  DefaultResourceLoader,
  type Skill,
} from "@earendil-works/pi-coding-agent";

const customSkill: Skill = {
  name: "release",
  description: "قوانین release ما",
  filePath: "/virtual/SKILL.md",
  baseDir: "/virtual",
  sourceInfo: createSyntheticSourceInfo("/virtual/SKILL.md", { source: "sdk" }),
  disableModelInvocation: false,
};

const loader = new DefaultResourceLoader({
  skillsOverride: (current) => {
    // فیلتر + افزودن:
    const filtered = current.skills.filter((s) => s.name.includes("search"));
    return { skills: [...filtered, customSkill], diagnostics: current.diagnostics };
  },
});
await loader.reload();

const { skills } = loader.getSkills(); // کشف‌شده‌ها (برای log)
const { session } = await createAgentSession({ resourceLoader: loader });
```

## ۱۱. فایل‌های زمینه (AGENTS.md) بدون فایل فیزیکی

```typescript
const loader = new DefaultResourceLoader({
  agentsFilesOverride: (current) => ({
    agentsFiles: [
      ...current.agentsFiles,
      { path: "/virtual/AGENTS.md", content: "# قواعد\n- commit با Conventional Commits" },
    ],
  }),
});
await loader.reload();
```

کشف پیش‌فرض: `AGENTS.md` از cwd تا بالا (repo root) + `AGENTS.md` سراسری.

## ۱۲. Slash commands / Prompt templates

```typescript
import type { PromptTemplate } from "@earendil-works/pi-coding-agent";

const deployCmd: PromptTemplate = {
  name: "deploy",
  description: "اپلیکیشن را deploy کن",
  source: "(custom)",
  content: "# Deploy\n1. build\n2. test\n3. deploy",
};

const loader = new DefaultResourceLoader({
  promptsOverride: (current) => ({
    prompts: [...current.prompts, deployCmd],
    diagnostics: current.diagnostics,
  }),
});
await loader.reload();
// حالا /deploy در session قابل استفاده است؛ prompt templates حین prompt() expand می‌شوند:
await session.prompt("/deploy", { expandPromptTemplates: true });
```

## ۱۳. Settings (SettingsManager)

```typescript
import { SettingsManager, createAgentSession } from "@earendil-works/pi-coding-agent";

// از فایل (global + project merge؛ project برنده)
const sm = SettingsManager.create(); // یا (cwd, agentDir)
sm.applyOverrides({
  compaction: { enabled: false },
  retry: { enabled: true, maxRetries: 5, baseDelayMs: 1000 },
});
sm.setDefaultThinkingLevel("low");
await sm.flush();            // نقطهٔ durability (قبل از exit)
for (const { scope, error } of sm.drainErrors()) {
  console.warn(`(${scope}) ${error.message}`); // SDK خود print نمی‌کند
}
const global = sm.getGlobalSettings();

// در حافظه (test، بدون I/O)
const test = SettingsManager.inMemory({ compaction: { enabled: false } });
```

## ۱۴. Sessionها: persistence، resume، tree

```typescript
import { SessionManager, createAgentSession } from "@earendil-works/pi-coding-agent";

// ۱) در حافظه (بدون persistence)
let { session } = await createAgentSession({ sessionManager: SessionManager.inMemory() });

// ۲) session پایدار جدید
({ session } = await createAgentSession({ sessionManager: SessionManager.create(process.cwd()) }));
console.log(session.sessionFile);

// ۳) ادامهٔ آخرین session
({ session, modelFallbackMessage } = await createAgentSession({
  sessionManager: SessionManager.continueRecent(process.cwd()),
}));
if (modelFallbackMessage) console.log("note:", modelFallbackMessage);

// ۴) باز کردن فایل مشخص / لیست
const sessions = await SessionManager.list(process.cwd());      // پروژهٔ جاری
const all = await SessionManager.listAll(process.cwd());        // همه
for (const s of sessions.slice(0, 3))
  console.log(s.id.slice(0, 8), "-", s.firstMessage.slice(0, 30));

// ۵) session خارج از فایل‌سیستم (مثلاً در DB) → restore
({ session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(process.cwd(), { id: mySessionId }, entriesFromDb),
}));
```

### Tree API (branching در همان فایل session)

```typescript
const sm = SessionManager.open("/path/to/session.jsonl");

sm.getEntries();            // همهٔ entries (بدون header)
sm.getTree();               // ساختار کامل tree
sm.getPath();               // مسیر از root تا leaf فعلی
sm.getLeafEntry();          // leaf فعلی
sm.getEntry(id);
sm.getChildren(id);
sm.getLabel(id);
sm.appendLabelChange(id, "checkpoint");   // label روی entry
sm.branch(entryId);                   // جابه‌جایی leaf به entry قبلی
sm.branchWithSummary(id, "خلاصه...");  // branch با summary context
sm.createBranchedSession(leafId);      // استخراج path به فایل جدید
```

### ناوبری tree داخل session

```typescript
// رفتن به یک entry دیگر در همان session (با summarize اختیاری):
const result = await session.navigateTree(targetId, {
  summarize: true,
  customInstructions: "خلاصهٔ کوتاه از کارهای قبلی",
  label: "checkpoint",
});
if (result.editorText) console.log(result.editorText);
```

## ۱۵. AgentSessionRuntime: new / switch / fork / clone / import

این همان لایه‌ای است که CLI/RPC باهاش کار می‌کند — برای اتوماسیونی که **session را عوض می‌کند** (مثلاً سرویس web با دکمهٔ /new و /resume):

```typescript
import {
  type CreateAgentSessionRuntimeFactory,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
  const services = await createAgentSessionServices({ cwd });
  return {
    ...(await createAgentSessionFromServices({ services, sessionManager, sessionStartEvent })),
    services,
    diagnostics: services.diagnostics,
  };
};

const runtime = await createAgentSessionRuntime(createRuntime, {
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  sessionManager: SessionManager.create(process.cwd()),
});

// ⚠️ بعد از هر جایگزینی، session عوض می‌شود → subscribe/بایند را دوباره:
async function bindSession() {
  const s = runtime.session;
  await s.bindExtensions({});
  s.subscribe((e) => { /* ... */ });
  return s;
}

await runtime.newSession();                              // session تازه
await runtime.switchSession("/path/to/session.jsonl");   // session دیگر
await runtime.fork("entry-id");                          // fork از یک entry کاربر
await runtime.fork("entry-id", { position: "at" });      // clone روی همان entry
await runtime.importFromJsonl(...);                       // import از JSONL

// اشتباهات creation/replacement throw می‌شوند → خودت handle کن
console.log(runtime.diagnostics);
await runtime.dispose();
```

## ۱۶. Compaction (مدیریت context در اجراهای بلند)

```typescript
const result = await session.compact("خلاصه کن با تمرکز روی تصمیمات گرفته‌شده");
session.abortCompaction(); // توقف compaction در حال‌عمل
```

## ۱۷. تصویر (vision)

```typescript
const img = await fs.readFile("screenshot.png");
await session.prompt("این UI چه مشکلی دارد؟", {
  images: [{
    type: "image",
    source: { type: "base64", mediaType: "image/png", data: img.toString("base64") },
  }],
});
```

## ۱۸. قطع کردن (abort) و idle-wait

```typescript
// با timeout:
const t = setTimeout(() => session.abort(), 60_000);
try {
  await session.prompt("کار سنگین");
} finally {
  clearTimeout(t);
  session.dispose();
}

// صبر تا agent به idle برسد (بعد از queue/steer):
await session.agent.waitForIdle();
```

## ۱۹. الگوی کامل: پایپ‌لاین اتوماسیون با full-control

«هر چیز را صریح‌کن» — بدون هیچ discovery (مناسب سرویس ایزوله/CI):

```typescript
import { getModel } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import {
  createAgentSession,
  createExtensionRuntime,
  ModelRuntime,
  type ResourceLoader,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";

const modelRuntime = await ModelRuntime.create({
  authPath: "/custom/agent/auth.json",
  modelsPath: "/custom/agent/models.json",
});
if (process.env.MY_KEY) {
  await modelRuntime.setRuntimeApiKey("anthropic", process.env.MY_KEY);
}

const model = getModel("anthropic", "claude-opus-4-5");
if (!model) throw new Error("Model not found");

const statusTool = Type; // (placeholder) — ابزار واقعی:
const statusToolDef = {
  name: "status",
  label: "Status",
  description: "Get system status",
  parameters: Type.Object({}),
  execute: async () => ({
    content: [{ type: "text", text: `Uptime: ${process.uptime()}s` }],
    details: {},
  }),
};

const settingsManager = SettingsManager.inMemory({
  compaction: { enabled: false },
  retry: { enabled: true, maxRetries: 2 },
});

// ResourceLoader دستی و صریح (هیچ فایل/کاتالوگی کشف نمی‌شود):
const resourceLoader: ResourceLoader = {
  getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
  getSkills: () => ({ skills: [], diagnostics: [] }),
  getPrompts: () => ({ prompts: [], diagnostics: [] }),
  getThemes: () => ({ themes: [], diagnostics: [] }),
  getAgentsFiles: () => ({ agentsFiles: [] }),
  getSystemPrompt: () => "You are a minimal assistant. Available: read, bash, status. Be concise.",
  getSystemPromptSource: () => undefined,
  getAppendSystemPrompt: () => [],
  getAppendSystemPromptSources: () => [],
  extendResources: () => {},
  reload: async () => {},
};

const { session } = await createAgentSession({
  cwd: process.cwd(),
  agentDir: "/custom/agent",
  model,
  thinkingLevel: "off",
  modelRuntime,
  resourceLoader,
  tools: ["read", "bash", "status"],
  customTools: [statusToolDef as never],
  sessionManager: SessionManager.inMemory(),
  settingsManager,
});

session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

await session.prompt("Get status and list files.");
```

## ۲۰. Run modes (بالای session، آماده برای ساخت UI/CLI)

```typescript
import {
  type CreateAgentSessionRuntimeFactory,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  InteractiveMode,
  runPrintMode,
  runRpcMode,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
  const services = await createAgentSessionServices({ cwd });
  return {
    ...(await createAgentSessionFromServices({ services, sessionManager, sessionStartEvent })),
    services,
    diagnostics: services.diagnostics,
  };
};
const runtime = await createAgentSessionRuntime(createRuntime, {
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  sessionManager: SessionManager.create(process.cwd()),
});

// A) TUI کامل
const mode = new InteractiveMode(runtime, {
  migratedProviders: [],
  modelFallbackMessage: undefined,
  initialMessage: "Hello",
  initialImages: [],
  initialMessages: [],
});
await mode.run();

// B) one-shot با output text/json
await runPrintMode(runtime, {
  mode: "text",
  initialMessage: "Hello",
  initialImages: [],
  messages: ["Follow up"],
});

// C) JSON-RPC (subprocess)
await runRpcMode(runtime);
```

**کِی RPC به‌جای SDK؟** زبان دیگر، process isolation، client زبانی‌آگاه. **SDK بهتر وقتی:** type-safety، همان پروسهٔ Node، دسترسی مستقیم به state، ابزار/اکستنشن برنامه‌نویسی‌شده. بدون SDK هم می‌توانی:

```bash
pi --mode rpc --no-session
```

(پروتکل JSON در مستند RPC)

## ۲۱. چند پروژه / fan-out

```typescript
const project = "/path/to/project";

// cwd سفارشی → ابزارها برای همان cwd ساخته می‌شوند
const { session } = await createAgentSession({
  cwd: project,
  tools: ["read", "bash", "grep"],
  sessionManager: SessionManager.inMemory(project),
});

// fan-out روی چند repo (Promise.all) — هر session مستقل:
const [a, b] = await Promise.all([
  createAgentSession({ cwd: repoA, sessionManager: SessionManager.inMemory(repoA) }),
  createAgentSession({ cwd: repoB, sessionManager: SessionManager.inMemory(repoB) }),
]);
await a.session.prompt("lint کن");
await b.session.prompt("lint کن");
```

## ۲۲. Exportهای مفید دیگر

```typescript
import {
  // tool factories (قابل استفاده خارج از session)
  createCodingTools,
  createReadOnlyTools,
  createReadTool, createBashTool, createPowerShellTool,
  createEditTool, createWriteTool,
  createGrepTool, createFindTool, createLsTool,

  // helpers
  getAgentDir,
  getPackageDir,
  getReadmePath,
  getDocsPath,
  getExamplesPath,
  CONFIG_DIR_NAME,
} from "@earendil-works/pi-coding-agent";
```

- خروجی `edit` tool: `details.diff` (برای TUI) و **`details.patch`** (unified patch استاندارد — برای SDK consumer)
- `createAgentSession()` برمی‌گرداند: `{ session, extensionsResult: { extensions, errors, runtime }, modelFallbackMessage? }`

---

## جدول نگاشت با مثال‌های رسمی (`examples/sdk/`)

| موضوع | فایل نمونه |
|-------|-----------|
| حداقلی | `01-minimal.ts` |
| مدل سفارشی | `02-custom-model.ts` |
| system prompt | `03-custom-prompt.ts` |
| skills | `04-skills.ts` |
| ابزارها + cwd | `05-tools.ts` |
| extensions | `06-extensions.ts` |
| context files | `07-context-files.ts` |
| prompt templates | `08-prompt-templates.ts` |
| API keys / OAuth | `09-api-keys-and-oauth.ts` |
| settings | `10-settings.ts` |
| sessions | `11-sessions.ts` |
| full control | `12-full-control.ts` |
| session runtime | `13-session-runtime.ts` |

## الگوهای عملی اتوماسیون (خلاصه)

| سناریو | ترکیب |
|--------|-------|
| CI/CD reviewer | read-only tools + custom review tool + in-memory session + `agent_end` → نتیجه |
| سرویس web chat | `AgentSessionRuntime` + `switchSession`/`fork` + subscribe به eventها → WebSocket |
| بات / دیمون | `runPrintMode` یا SDK + `SessionManager.continueRecent` برای حافظهٔ بلندمدت |
| اجرای چند پروژه | fan-out با `cwd` جدا + `SessionManager.inMemory(cwd)` |
| امنیت | `excludeTools: ["bash"]` یا block در اکستنشن + `noTools: "builtin"` |
| مدیریت context | `compact()` + `navigateTree()` + `branchWithSummary()` |
| audit trail | اکستنشن با `pi.on("tool_call")` + `eventBus` |
| تست واحد agent | `SettingsManager.inMemory` + `SessionManager.inMemory` + `InMemoryCredentialStore` |
