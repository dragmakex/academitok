import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as ServiceMap from "effect/ServiceMap"

type PyroscopeApi = {
  init: (options: {
    serverAddress: string
    appName: string
    tags?: Record<string, string>
  }) => void
  start: () => void
  stop?: () => void | Promise<void>
}

class PyroscopeServerConfig extends ServiceMap.Service<
  PyroscopeServerConfig,
  {
    readonly serverAddress: Option.Option<string>
    readonly serviceName: string
    readonly environment: string
    readonly runtimeOverride: Option.Option<"bun" | "node">
  }
>()("@app/PyroscopeServerConfig", {
  make: Effect.gen(function*() {
    const serverAddress = yield* Config.option(
      Config.string("PYROSCOPE_SERVER_ADDRESS"),
    )
    const serviceName = yield* Config.string("SERVICE_NAME").pipe(
      Config.orElse(() => Config.succeed("effect-tanstack-start")),
    )
    const environment = yield* Config.string("NODE_ENV").pipe(
      Config.orElse(() => Config.succeed("development")),
    )
    const runtimeOverride = yield* Config
      .option(
        Config.string("DATADOG_PPROF_RUNTIME"),
      )
      .pipe(
        Config.map(
          Option.filter((value) => value === "bun" || value === "node"),
        ),
      )

    return {
      serverAddress,
      serviceName,
      environment,
      runtimeOverride,
    }
  }),
}) {
  static readonly layer = Layer.effect(this, this.make)
}

const state = {
  initialized: false,
  stop: undefined as undefined | (() => Promise<void>),
}

const initProgram = Effect
  .gen(function*() {
    const alreadyInitialized = yield* Effect.sync(() => state.initialized)
    if (alreadyInitialized) {
      return
    }

    const config = yield* PyroscopeServerConfig
    if (Option.isNone(config.serverAddress)) {
      return
    }

    const hasBunRuntime = typeof process.versions.bun === "string"
    // This app runs on Bun. In some dev paths, route modules execute on a Node-like runtime.
    // Default to Bun backend unless the user explicitly overrides runtime.
    const runtime = Option.isSome(config.runtimeOverride)
      ? config.runtimeOverride.value
      : hasBunRuntime
      ? "bun"
      : "bun"
    process.env.DATADOG_PPROF_RUNTIME = runtime

    const module = (yield* Effect
      .promise(() => import("@pyroscope/nodejs"))) as {
        default?: PyroscopeApi
      }
    const pyroscope = (module.default ?? module) as PyroscopeApi

    pyroscope.init({
      serverAddress: config.serverAddress.value,
      appName: config.serviceName,
      tags: {
        env: config.environment,
        runtime,
      },
    })
    pyroscope.start()

    yield* Effect.sync(() => {
      state.stop = async () => {
        await Promise.resolve(pyroscope.stop?.())
      }
      state.initialized = true
    })

    console.log(
      `[Pyroscope] started service=${config.serviceName} runtime=${runtime}`,
    )
  })
  .pipe(Effect.provide(PyroscopeServerConfig.layer))

const shutdownProgram = Effect.gen(function*() {
  const initialized = yield* Effect.sync(() => state.initialized)
  if (!initialized) {
    return
  }

  const stop = yield* Effect.sync(() => state.stop)
  yield* Effect.promise(() => stop?.() ?? Promise.resolve())
  yield* Effect.sync(() => {
    state.stop = undefined
    state.initialized = false
  })
  console.log("[Pyroscope] stopped")
})

/**
 * Initialize Pyroscope continuous profiling for server runtime.
 * Safe to call multiple times.
 */
export async function initPyroscopeServer() {
  await Effect.runPromise(initProgram)
}

/**
 * Stop Pyroscope if initialized.
 */
export async function shutdownPyroscopeServer() {
  await Effect.runPromise(shutdownProgram)
}
