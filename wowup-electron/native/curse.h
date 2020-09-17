#include <napi.h>

namespace curse
{
    std::string hello();
    Napi::String HelloWrapped(const Napi::CallbackInfo &info);

    uint32_t add(int a, int b);
    Napi::Number AddWrapped(const Napi::CallbackInfo &info);

    bool isWhitespaceCharacter(char b);
    uint32_t computeNormalizedLength(char *input, int length);
    uint32_t computeHash(char *buffer, int length);
    Napi::Number ComputeHashWrapped(const Napi::CallbackInfo &info);

    Napi::Object Init(Napi::Env env, Napi::Object exports);
} // namespace curse