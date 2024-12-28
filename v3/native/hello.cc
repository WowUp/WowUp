  
#include <napi.h>
#include "curse.h"

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    curse::Init(env, exports);
    return exports;
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, InitAll)
