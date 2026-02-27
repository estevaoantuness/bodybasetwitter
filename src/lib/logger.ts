export const log = (step: string, data?: object): void => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), step, ...data }))
}
