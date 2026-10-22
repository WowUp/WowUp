#include "curse.h"
#include <fstream>

std::string curse::hello()
{
  return "Hello World";
}

uint32_t curse::add(int a, int b)
{
  return (uint32_t)1767121699 * (uint32_t)1540483477;
  // return a + b;
}

Napi::String curse::HelloWrapped(const Napi::CallbackInfo &info)
{
  Napi::Env env = info.Env();
  Napi::String returnValue = Napi::String::New(env, curse::hello());
  return returnValue;
}

Napi::Number curse::AddWrapped(const Napi::CallbackInfo &info)
{
  Napi::Env env = info.Env();
  if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsNumber())
  {
    Napi::TypeError::New(env, "Number expected").ThrowAsJavaScriptException();
  }

  Napi::Number first = info[0].As<Napi::Number>();
  Napi::Number second = info[1].As<Napi::Number>();

  uint32_t returnValue = curse::add(first.Int32Value(), second.Int32Value());

  return Napi::Number::New(env, returnValue);
}

bool curse::isWhitespaceCharacter(char b)
{
  return b == 9 || b == 10 || b == 13 || b == 32;
}

uint32_t curse::computeNormalizedLength(char *input, int length)
{
  int32_t num1 = 0;

  for (int32_t index = 0; index < length; ++index)
  {
    if (!curse::isWhitespaceCharacter(input[index]))
    {
      ++num1;
    }
  }
  return num1;
}

uint32_t curse::computeHash(char *buffer, int length)
{
  // std::ofstream myfile("hash.txt", std::ios::out | std::ios::binary);

  uint32_t multiplex = 1540483477;
  uint32_t num1 = length;

  if (true)
  {
    num1 = curse::computeNormalizedLength(buffer, length);
  }

  uint32_t num2 = (uint32_t)1 ^ num1;
  uint32_t num3 = 0;
  uint32_t num4 = 0;

  for (int index = 0; index < length; ++index)
  {
    unsigned char b = buffer[index];

    if (!curse::isWhitespaceCharacter(b))
    {
      num3 |= (uint32_t)b << num4;

      num4 += 8;
      if (num4 == 32)
      {
        uint32_t num6 = num3 * multiplex;
        uint32_t num7 = (num6 ^ num6 >> 24) * multiplex;

        num2 = num2 * multiplex ^ num7;
        num3 = 0;
        num4 = 0;
      }
    }
  }

  if (num4 > 0)
  {
    num2 = (num2 ^ num3) * multiplex;
  }

  uint32_t num6 = (num2 ^ num2 >> 13) * multiplex;

  return num6 ^ num6 >> 15;
}

Napi::Number curse::ComputeHashWrapped(const Napi::CallbackInfo &info)
{
  Napi::Env env = info.Env();
  if (info.Length() < 2 || !info[0].IsBuffer() || !info[1].IsNumber())
  {
    Napi::TypeError::New(env, "Buffer, Number expected").ThrowAsJavaScriptException();
  }

  Napi::Buffer<char> buffer = info[0].As<Napi::Buffer<char>>();
  Napi::Number length = info[1].As<Napi::Number>();

  uint32_t returnValue = curse::computeHash(buffer.Data(), length.Int32Value());

  return Napi::Number::New(env, returnValue);
}

Napi::Object curse::Init(Napi::Env env, Napi::Object exports)
{
  exports.Set("computeHash", Napi::Function::New(env, curse::ComputeHashWrapped));
  exports.Set("hello", Napi::Function::New(env, curse::HelloWrapped));
  exports.Set("add", Napi::Function::New(env, curse::AddWrapped));
  return exports;
}