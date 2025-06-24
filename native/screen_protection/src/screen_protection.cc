#include <napi.h>
#include <windows.h>

// Ensure constant is present for older SDKs
#ifndef WDA_EXCLUDEFROMCAPTURE
#define WDA_EXCLUDEFROMCAPTURE 0x00000011
#endif

// setProtection(HWND buffer, bool enable) -> boolean success
Napi::Value SetProtection(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 2 || !info[0].IsBuffer() || !info[1].IsBoolean()) {
    Napi::TypeError::New(env, "Expected Buffer, Boolean").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Buffer<uint8_t> handleBuffer = info[0].As<Napi::Buffer<uint8_t>>();
  bool enable = info[1].As<Napi::Boolean>().Value();

  // Read pointer-size value from buffer (assumes little-endian Windows)
  uintptr_t hwndInt = 0;
  memcpy(&hwndInt, handleBuffer.Data(), sizeof(hwndInt));
  HWND hWnd = reinterpret_cast<HWND>(hwndInt);

  DWORD affinity = enable ? WDA_EXCLUDEFROMCAPTURE : WDA_NONE;
  BOOL result = SetWindowDisplayAffinity(hWnd, affinity);
  return Napi::Boolean::New(env, result == TRUE);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(Napi::String::New(env, "setProtection"), Napi::Function::New(env, SetProtection));
  return exports;
}

NODE_API_MODULE(screen_protection, Init)
