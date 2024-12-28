export async function limitedPromiseAll<T, TOUT>(
  list: T[],
  predicate: (item: T) => Promise<TOUT>,
  limit: number
): Promise<TOUT[]> {
  const results: Promise<TOUT>[] = []
  const executing: Promise<TOUT>[] = []

  for (const item of list) {
    const promise = predicate(item).then((result) => {
      // Remove resolved promise from the executing list
      executing.splice(executing.indexOf(promise), 1)
      return result
    })
    results.push(promise)
    executing.push(promise)

    if (executing.length >= limit) {
      // Wait for the first promise to resolve before continuing
      await Promise.race(executing)
    }
  }

  return Promise.all(results)
}

export async function limitedForEach<T>(
  list: T[],
  op: (item: T) => Promise<void>,
  limit: number
): Promise<void> {
  const results: Promise<void>[] = []
  const executing: Promise<void>[] = []

  for (const item of list) {
    const promise = op(item).then((result) => {
      // Remove resolved promise from the executing list
      executing.splice(executing.indexOf(promise), 1)
      return result
    })
    results.push(promise)
    executing.push(promise)

    if (executing.length >= limit) {
      // Wait for the first promise to resolve before continuing
      await Promise.race(executing)
    }
  }

  await Promise.all(results)
}

// export async function limitedPromiseAll<T>(
//   tasks: (() => Promise<T>)[],
//   limit: number
// ): Promise<T[]> {
//   const results: Promise<T>[] = []
//   const executing: Promise<T>[] = []

//   for (const task of tasks) {
//     const promise = task().then((result) => {
//       // Remove resolved promise from the executing list
//       executing.splice(executing.indexOf(promise), 1)
//       return result
//     })
//     results.push(promise)
//     executing.push(promise)

//     if (executing.length >= limit) {
//       // Wait for the first promise to resolve before continuing
//       await Promise.race(executing)
//     }
//   }

//   return Promise.all(results)
// }
