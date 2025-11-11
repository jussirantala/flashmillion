**Source:** Internal compilation from Steinberg VST3 SDK documentation

# VST3 Plugin Development Guide for Beginners

Creating VST3 plugins is a rewarding way to build audio effects or instruments that integrate with DAWs like Ableton Live, FL Studio, or Reaper. The official **VST3 SDK** from Steinberg is free and the standard way to get started.

Below is a **step-by-step guide** tailored for beginners, with modern tools (CMake, C++17/20) and cross-platform support (Windows, macOS, Linux).

---

## 1. **Prerequisites**

| Tool | Purpose | Link |
|------|-------|------|
| **C++ Compiler** | GCC, Clang, or MSVC | Install via [MSYS2](https://www.msys2.org/) (Win), Xcode (macOS), or `g++` (Linux) |
| **CMake ≥ 3.15** | Build system | [cmake.org](https://cmake.org/download/) |
| **Git** | Clone SDK | [git-scm.com](https://git-scm.com) |
| **VST3 SDK** | Core headers & framework | [steinbergmedia.github.io/vst3_dev_portal](https://steinbergmedia.github.io/vst3_dev_portal/pages/index.html) |
| **IDE (Optional)** | VS Code, CLion, Visual Studio | Recommended: **VS Code + CMake Tools** |

---

## 2. **Download the VST3 SDK**

```bash
git clone https://github.com/steinbergmedia/vst3sdk.git
cd vst3sdk
git submodule update --init
```

> The SDK includes:
> - `pluginterfaces/` – VST3 interface definitions
> - `public.sdk/` – Helper classes
> - `cmake/` – Modern CMake modules

---

## 3. **Create a Minimal Plugin Project**

### Directory Structure
```
my_vst3_plugin/
├── CMakeLists.txt
├── src/
│   ├── plugin.cpp
│   ├── plugin.h
│   └── factory.cpp
└── resources/
    └── (optional GUI .ui, icons)
```

---

### `CMakeLists.txt` (Modern CMake)

```cmake
cmake_minimum_required(VERSION 3.15)
project(MyVST3Plugin LANGUAGES CXX)

# Enable C++17 or C++20
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find VST3 SDK (adjust path!)
set(VST3_SDK_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/../vst3sdk")
add_subdirectory(${VST3_SDK_ROOT} vst3sdk)

# Create plugin target
steinberg_vst3_plugin(MyVST3Plugin
    SOURCES
        src/plugin.cpp
        src/plugin.h
        src/factory.cpp
)

# Optional: Copy to user VST3 folder after build
if(APPLE)
    set(VST3_OUTPUT_DIR "$ENV{HOME}/Library/Audio/Plug-Ins/VST3")
elseif(WIN32)
    set(VST3_OUTPUT_DIR "$ENV{CommonProgramFiles}/VST3")
else() # Linux
    set(VST3_OUTPUT_DIR "$ENV{HOME}/.vst3")
endif()

add_custom_command(TARGET MyVST3Plugin POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory "${VST3_OUTPUT_DIR}"
    COMMAND ${CMAKE_COMMAND} -E copy_directory
        "$<TARGET_FILE_DIR:MyVST3Plugin>"
        "${VST3_OUTPUT_DIR}/MyVST3Plugin.vst3"
)
```

---

### `src/plugin.h`

```cpp
#pragma once
#include "pluginterfaces/vst/ivstaudioprocessor.h"
#include "pluginterfaces/vst/ivsteditcontroller.h"
#include "public.sdk/source/vst/vstaudioprocessoralgo.h"

using namespace Steinberg;
using namespace Steinberg::Vst;

class MyGainPlugin : public AudioEffect
{
public:
    MyGainPlugin();

    // --- IAudioProcessor ---
    tresult PLUGIN_API initialize(FUnknown* context) override;
    tresult PLUGIN_API setBusArrangements(SpeakerArrangement* inputs, int32 numIns,
                                          SpeakerArrangement* outputs, int32 numOuts) override;
    tresult PLUGIN_API canProcessSampleSize(int32 symbolicSampleSize) override;
    tresult PLUGIN_API process(ProcessData& data) override;

    // --- IEditController ---
    tresult PLUGIN_API setComponentState(IBStream* state) override;

    static FUnknown* createInstance(void*) { return (IAudioProcessor*)new MyGainPlugin(); }

    OBJ_METHODS(MyGainPlugin, AudioEffect)
    DEFINE_INTERFACES
        DEF_INTERFACE(IAudioProcessor)
    END_DEFINE_INTERFACES(AudioEffect)
    REFCOUNT_METHODS(AudioEffect)
};
```

---

### `src/plugin.cpp`

```cpp
#include "plugin.h"
#include "pluginterfaces/base/ibstream.h"

MyGainPlugin::MyGainPlugin() : AudioEffect()
{
    setControllerClass(MyGainPluginController::cid);
}

tresult PLUGIN_API MyGainPlugin::initialize(FUnknown* context)
{
    tresult result = AudioEffect::initialize(context);
    if (result != kResultOk) return result;

    // 2 in, 2 out, 32-bit float
    addAudioInput(STR16("Stereo In"), SpeakerArr::kStereo);
    addAudioOutput(STR16("Stereo Out"), SpeakerArr::kStereo);

    return kResultOk;
}

tresult PLUGIN_API MyGainPlugin::setBusArrangements(...)
{
    // Accept stereo in/out only
    if (numIns == 1 && numOuts == 1 &&
        inputs[0].arrangement == SpeakerArr::kStereo &&
        outputs[0].arrangement == SpeakerArr::kStereo)
        return kResultTrue;
    return kResultFalse;
}

tresult PLUGIN_API MyGainPlugin::canProcessSampleSize(int32 symbolicSampleSize)
{
    return symbolicSampleSize == kSample32 ? kResultTrue : kResultFalse;
}

tresult PLUGIN_API MyGainPlugin::process(ProcessData& data)
{
    if (data.numInputs == 0 || data.numOutputs == 0) return kResultOk;

    // Simple gain: multiply by 0.5
    float** in = data.inputs[0].channelBuffers32;
    float** out = data.outputs[0].channelBuffers32;
    int32 numChannels = data.inputs[0].numChannels;
    int32 numSamples = data.numSamples;

    for (int32 c = 0; c < numChannels; c++)
    {
        for (int32 i = 0; i < numSamples; i++)
        {
            out[c][i] = in[c][i] * 0.5f;
        }
    }

    return kResultOk;
}

tresult PLUGIN_API MyGainPlugin::setComponentState(IBStream* state)
{
    // Optional: load parameters from preset
    return kResultOk;
}
```

---

### `src/factory.cpp` (Entry Point)

```cpp
#include "public.sdk/source/main/pluginfactory.h"
#include "plugin.h"

using namespace Steinberg;
using namespace Steinberg::Vst;

BEGIN_FACTORY_DEF("Your Name", "https://yoursite.com", "mailto:you@example.com")

    DEF_CLASS2(
        INLINE_UID_FROM_FUID(MyGainPlugin::cid),
        PClassInfo::kManyInstances,
        kVstAudioEffectClass,
        "My Gain Plugin",
        Vst::kDistributable,
        Vst::PlugType::kFx,
        "1.0.0",
        kVstVersionString,
        MyGainPlugin::createInstance
    )

END_FACTORY
```

> Generate a unique UID using `uuidgen` (macOS/Linux) or online tool.

---

## 4. **Build the Plugin**

```bash
mkdir build && cd build
cmake .. -G "Ninja"  # or "Visual Studio 17 2022"
cmake --build .
```

Your plugin will be copied to:
- **Windows**: `C:\Program Files\Common Files\VST3\MyVST3Plugin.vst3`
- **macOS**: `~/Library/Audio/Plug-Ins/VST3/MyVST3Plugin.vst3`
- **Linux**: `~/.vst3/MyVST3Plugin.vst3`

---

## 5. **Test in a DAW**

1. Open your DAW (e.g., Reaper, Bitwig)
2. Rescan plugins
3. Load **My Gain Plugin** → should reduce volume by 50%

---

## 6. **Next Steps**

| Goal | Tool/Feature |
|------|-------------|
| **GUI** | Use **VSTGUI** (included in SDK) or **JUCE** |
| **Parameters** | `ParameterContainer`, `IParamValueQueue` |
| **Presets** | Implement `IComponentHandler` |
| **MIDI** | Check `data.inputEvents` in `process()` |
| **Cross-Platform** | Use CMake + JUCE (easier) |

---

## Recommended Starter Templates

| Project | Link |
|-------|------|
| **Official VST3 Project Generator** | https://github.com/steinbergmedia/vst3_project_generator |
| **JUCE + VST3** (easier GUI) | https://juce.com |
| **Minimal CMake Example** | https://github.com/sudara/minimal-vst3 |

---

## Useful Resources

- **VST3 SDK Docs**: https://steinbergmedia.github.io/vst3_doc/
- **VST3 Examples**: `vst3sdk/public.sdk/samples/vst/`
- **Pamplejuce** (JUCE + CMake): https://github.com/sudara/pamplejuce

---

## Summary

1. Clone VST3 SDK
2. Use CMake + `steinberg_vst3_plugin()` macro
3. Implement `AudioEffect` with `process()`
4. Build → `.vst3` bundle appears in DAW

You now have a working VST3 plugin!

Let me know if you want:
- A **GUI version** with VSTGUI
- **JUCE-based** starter
- **MIDI synth** example
- **ARM64 / Apple Silicon** build tips

Happy coding! 🎧
