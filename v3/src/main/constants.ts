export const APP_USER_MODEL_ID = 'io.wowup.jliddev' // Bundle ID
export const APP_USER_MODEL_ID_CF = 'io.wowupcf.jliddev' // Bundle ID
export const BUILD_FLAVOR = import.meta.env.MAIN_VITE_BUILD_FLAVOR

export const IS_WAGO = BUILD_FLAVOR === 'wago'
export const IS_OW = BUILD_FLAVOR === 'ow'
export const IS_PORTABLE = !!process.env.PORTABLE_EXECUTABLE_DIR
