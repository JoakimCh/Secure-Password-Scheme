
//#region classes and functions
const isFirefox = navigator.userAgent.includes('Firefox') // check if buggy browser

function initLightSwitch(stylesheetId, buttonId) {
  const stylesheet = document.getElementById(stylesheetId)
  const lightSwitch = document.getElementById(buttonId)
  function colorSchemeChange(dark) {
    if (typeof dark == 'string') dark = dark == 'true'
    stylesheet.disabled = dark
    lightSwitch.innerText = dark ? 'Lights on' : 'Lights off'
    localStorage.setItem('dark', dark)
  }
  const mql = window.matchMedia('(prefers-color-scheme: dark)')
  mql.addEventListener('change', e => colorSchemeChange(e.matches))
  colorSchemeChange(localStorage.getItem('dark') ?? mql.matches)
  lightSwitch.addEventListener('click', () => colorSchemeChange(!stylesheet.disabled))
}

async function registerServiceWorker(url, options, installButtonId) {
  if (installButtonId) {
    let firstPromt = true, installPrompt
    window.addEventListener('beforeinstallprompt', async e => {
      console.log('beforeinstallprompt')
      installPrompt = e
      if (firstPromt) {
        firstPromt = false
        e.preventDefault() // do not show
        const installButton = document.getElementById(installButtonId)
        installButton.hidden = false
        installButton.addEventListener('click', async () => {
          installPrompt.prompt()
          if ((await installPrompt.userChoice).outcome == 'accepted') {
            installButton.hidden = true
          }
        })
      }
    })
  }
  let registration
  try {
    if ('serviceWorker' in navigator) registration = await navigator.serviceWorker.register(url, {
      type: 'module',
      ...options
    })
  } catch {} // ignore any error
  return registration
}

/** Cryptographically Secure Pseudo-Random Number Generator (using PBKDF2 and AES-CTR). */
class CSPRNG {
  #aesKey; #iv; #u32buffer; #bufferIndex
  #blocksToBuffer = 200 // since each call to subtle.encrypt is quite slow

  /** Set the nonce and the counter value in the IV. Each call to `randomUint32()` will increment the counter. */
  setIV({nonce, counter}) {
    if (nonce != undefined) this.#iv.setBigUint64(0, nonce)
    if (counter != undefined) this.#iv.setBigUint64(8, counter) // the LSB
    this.#u32buffer = null
  }
  getCounter() {
    return this.#iv.getBigUint64(8)
  }
  get bufferIndex() {return this.#bufferIndex}
  /** Generate a new secure key by "expanding the bits" in the given seed using PBKDF2. Clears any IV. */
  async setKey({keySeed, salt = new ArrayBuffer(0), iterations = 100_000}) {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      keySeed,
      {name: 'PBKDF2'},
      false,
      ['deriveBits', 'deriveKey']
    )

    this.#aesKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      {name: 'AES-CTR', length: 256},
      true,
      ['encrypt']
    )

    this.#iv = new DataView(new ArrayBuffer(16)) // 16 bytes / 128 bits
    this.#u32buffer = null
  }

  /** Encrypt a new block (increments the IV counter) and extract 32 bits from it. */
  async randomUint32() {
    if (!this.#u32buffer || this.#bufferIndex == this.#u32buffer.length) {
      this.#u32buffer = new Uint32Array(await crypto.subtle.encrypt(
        {
          name: 'AES-CTR',
          counter: this.#iv,
          length: 64 // bit-size of block counter in IV
        }, 
        this.#aesKey,
        new ArrayBuffer(16 * this.#blocksToBuffer)
      ))
      // increment the block counter to be correct for the next batch
      this.#iv.setBigUint64(8, this.#iv.getBigUint64(8) + BigInt(this.#blocksToBuffer))
      this.#bufferIndex = 0 // reset
    }
    return this.#u32buffer[this.#bufferIndex++]
  }

  async randomInteger(minOrMax = 0, max = 0xFFFF_FFFF) {
    let min = minOrMax
    switch (arguments.length) {
      case 0: return await this.randomUint32()
      case 1: max = minOrMax; min = 0; break
      case 2: if (minOrMax > max) {min = max; max = minOrMax}; break
    }
    const range = max - min
    const randomInt = await this.randomUint32()
    return min + (randomInt > range ? randomInt % (range+1) : randomInt)
  }
}

const letters = 'abcdefghijklmnopqrstuvwxyz'
const numbers = '0123456789'
const symbols = '~`!@#$%^&*_-+=(){}[]|\\:;"\'<>,.?/'

class PasswordGenerator {
  #csprng = new CSPRNG()

  setKey({personalSeed, serviceSeed}) {
    return this.#csprng.setKey({
      keySeed: personalSeed,
      salt: new TextEncoder().encode(serviceSeed)
    })
  }

  setIteration(iteration) {
    this.#csprng.setIV({nonce: BigInt(iteration)})
  }

  async generatePassword({
    length = 25, 
    minLower = 1, 
    numUpper = Math.ceil(length / 8), 
    numNumbers = Math.ceil(length / 8), 
    numSymbols = Math.ceil(length / 8)
  } = {}) {
    this.#csprng.setIV({counter: 0n}) // reset block counter
    const numLower = length - (numUpper + numNumbers + numSymbols)
    if (numLower < minLower) throw Error()
    let password = new Array(length)
    for (let type=0; type<3; type++) {
      let charList, charsNeeded
      switch (type) {
        case 0: charsNeeded = numUpper;   charList = letters.toUpperCase(); break
        case 1: charsNeeded = numNumbers; charList = numbers; break
        case 2: charsNeeded = numSymbols; charList = symbols; break
      }
      let charsPlaced = 0
      while (charsPlaced < charsNeeded)  {
        let index = await this.#csprng.randomInteger(length-1)
        const char = charList[await this.#csprng.randomInteger(charList.length-1)]
        if (password[index] != undefined) {
          const searchDirection = index % 2 // (random)
          while (true) {
            if (searchDirection == 0) {
              if (++index == password.length) index = 0
            } else {
              if (--index == -1) index = password.length-1
            }
            if (password[index] == undefined) break
          }
        }
        password[index] = char
        charsPlaced ++
      }
    }
    for (let i=0; i<length; i++) { // fill the rest with lowercase
      if (password[i] == undefined) {
        password[i] = letters[await this.#csprng.randomInteger(letters.length-1)]
      }
    }
    return password.join('')
  }
}

const personalSeedHash = new Uint8Array(new ArrayBuffer(100)) // 800 bits
async function updateIdSeed(personalSeedInput) {
  const prng = new CSPRNG()
  await prng.setKey({
    keySeed: new TextEncoder().encode(personalSeedInput)
  })
  prng.setIV({nonce: 0n, counter: 0n})
  const ctx = document.getElementById('idCanvas').getContext('2d')
  const blockSize = 5, numBlocks = 100 / blockSize
  let i = 0
  for (let x=numBlocks/2-1; x>=0; x--) {
    for (let y=numBlocks/2-1; y>=0; y--) {
      const rnd = await prng.randomUint32()
      personalSeedHash[i++] = rnd & 0xFF
      const r = rnd >> 0 & 1 * 255
      const g = rnd >> 1 & 1 * 255
      const b = rnd >> 2 & 1 * 255
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
      ctx.fillRect(x*blockSize, y*blockSize, blockSize, blockSize)
      ctx.fillRect(((numBlocks-2)-x)*blockSize, y*blockSize, blockSize, blockSize)
      ctx.fillRect(((numBlocks-2)-x)*blockSize, ((numBlocks-2)-y)*blockSize, blockSize, blockSize)
      ctx.fillRect(x*blockSize, ((numBlocks-2)-y)*blockSize, blockSize, blockSize)
    }
  }
}

function clearIdCanvas() {
  const ctx = document.getElementById('idCanvas').getContext('2d')
  ctx.font = 'bold 18px monospace'
  ctx.fillStyle = 'red'
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.fillText('Invalid', 10, 40)
  ctx.fillText(' input', 10, 60)
}

/** Remove excessive spaces, any dots and convert to lower case. */
function normalizeInput(...input) {
  return input.filter(s => s).join('-') // merge multiple input
    .replace(/\s+/g, ' ').trim() // remove all excessive spaces
    .replaceAll('.', '') // remove dots
    .toLowerCase() // ignore case
}

function validateMasterPassword() {
  // see https://developer.mozilla.org/en-US/docs/Learn/Forms/Form_validation#validating_forms_using_javascript
  function reportValidity(message) {
    inp_master.setCustomValidity(message)
    const result = inp_master.reportValidity()
    if (isFirefox // Firefox fix to actually update the message
        && message != '' // fix Firefox from jumping to next input
        && inp_master == document.activeElement) {
      inp_master.blur()
      inp_master.focus()
      // if on Android then Firefox doesn't even show these at all: https://bugzilla.mozilla.org/show_bug.cgi?id=1510450
    }
    return result
  }
  const pw = inp_master.value
  const numUpper = pw.replace(/[^A-Z]/g, '').length
  if (numUpper < 1) return reportValidity('Password must contain at least 1 upper case character!')
  const numDigit = pw.replace(/[^0-9]/g, '').length
  if (numDigit < 1) return reportValidity('Password must contain at least 1 number!')
  if ([...pw].length < 8) return reportValidity('Password must be 8 or more characters!')
  return reportValidity('') // pass it
}

function validateBirthdate() {
  function invalid() {
    inp_birthdate.setCustomValidity('"'+date+'" is not a valid birthdate. The date must be written as DDMMYYYY, e.g. 21021982 for someone born 21st February of 1982.')
    inp_birthdate.reportValidity()
  }
  const date = inp_birthdate.value
  if (date.length != 8) return invalid()
  const day = +date.slice(0,2)
  const month = +date.slice(2,4)
  const year = +date.slice(4,8)
  if (day < 1 || day > 31) return invalid()
  if (month < 1 || month > 12) return invalid()
  if (year < 1900 || year > 2100) return invalid()
  inp_birthdate.setCustomValidity('') // pass
  return inp_birthdate.reportValidity()
}

/** Just a dead simple mutex. */
class SimpleMutex {
  #lock
  async lock() {
    const waitFor = this.#lock
    let ourLockResolve
    const ourLock = new Promise(resolve => ourLockResolve = resolve)
    this.#lock = ourLock
    await waitFor
    return ourLockResolve
  }
}

const personalSeedInputMutex = new SimpleMutex()
let latestPersonalSeedInput
async function personalSeedChange(e) { // to update fingerprint
  if (!shredderInterval) startShredderCountdown()
  resetShredderCountdown()
  if (e.srcElement.name == 'inp_birthdate') {
    if (inp_birthdate.validity.valid == false) { // then pass it to stop error messages at every new letter (it will be validated again on focusout)
      inp_birthdate.setCustomValidity('')
      inp_birthdate.reportValidity()
    }
  } else if (e.srcElement.name == 'inp_master') {
    validateMasterPassword()
  }
  const unlock = await personalSeedInputMutex.lock() // wait for any previous updateIdHash call to finish
    // then check if the latest input has changed before calling it again (since a lot of these input event handlers could be waiting)
    const inp_person_norm = normalizeInput(inp_person.value)
    if (inp_person_norm == '' || inp_birthdate.value == '' || inp_master.value == '') {
      clearIdCanvas()
      return unlock()
    }
    const latestInput = inp_person_norm + inp_birthdate.value + inp_master.value
    if (latestInput != latestPersonalSeedInput) {
      latestPersonalSeedInput = latestInput
      await updateIdSeed(latestInput)
    }
  unlock() // allow next input check
}

function downloadFingerprint() {
  const link = document.createElement('a')
  link.download = 'personal_seed_fingerprint.png'
  link.href = document.getElementById('idCanvas').toDataURL()
  link.click()
}

let shredderInterval, unixTimeLastInterval
function startShredderCountdown() {
  if (shredderInterval) return
  shredderInterval = setInterval(function() {
    // we can't trust the browser NOT to pause it, hence we must check the elapsed time at each call
    const unixTime = Math.round(Date.now() / 1000)
    if (unixTimeLastInterval) {
      const diff = unixTime - unixTimeLastInterval
      inp_countdown.value = (+inp_countdown.value) + diff
      if (+inp_countdown.value >= inp_countdown.max) {
        // frm_personalSeed.reset()
        location.reload() // leave no traces (e.g. clears variables in our JS)
      }
    }
    unixTimeLastInterval = unixTime
  }, 1000)
}

function resetShredderCountdown() {
  inp_countdown.value = inp_countdown.min
}

function getElementByIds(...ids) {
  const result = {}
  for (const id of ids) {
    result[id] = document.getElementById(id)
    if (!result[id]) throw Error('No element with ID: '+id)
  }
  return result
}

const listedPw = new Set()
let pwId = 0
function listPassword(service, iteration, password) {
  if (listedPw.has(password)) return
  else listedPw.add(password)
  pwId++
  const container = document.getElementById('con_generatedPasswords')
  if (container.childElementCount == 1) container.style.display = 'flex'
  const pwAndLabelCon = document.createElement('div')
  pwAndLabelCon.className = 'con_labelAndPassword'
  const label = document.createElement('label')
  if (iteration > 0) label.innerText = service+` (it.:${iteration}):`
  else label.innerText = service+':'
  label.setAttribute('for', 'pw'+pwId)
  const spacer = document.createElement('div')
  spacer.className = 'flexSpacer'
  const pw = document.createElement('input')
  pw.id = 'pw'+pwId
  pw.type = 'password'
  pw.readOnly = true
  pw.size = 25
  pw.value = password
  pw.className = 'generatedPw'
  const btnCopy = document.createElement('button')
  btnCopy.innerText = 'Copy'
  const btnView = document.createElement('button')
  btnView.innerText = 'View'
  const btnX = document.createElement('button')
  btnX.innerText = 'X'
  btnX.ariaLabel = 'Remove'
  pwAndLabelCon.append(label, spacer, btnCopy, btnView, pw, btnX)
  container.append(pwAndLabelCon)
  btnCopy.focus()
  btnCopy.onclick = () => {navigator.clipboard.writeText(pw.value)}
  btnView.onclick = () => {
    if (pw.type == 'text') {
      pw.type = 'password'
      btnView.innerText = 'View'
    } else {
      pw.type = 'text'
      btnView.innerText = 'Hide'
    }
  }
  btnX.onclick = () => {
    listedPw.delete(password)
    pwAndLabelCon.remove()
    if (container.childElementCount == 1) container.style.display = 'none'
  }
}

function validateForms(notServiceForm) {
  if (!frm_personalSeed.reportValidity()) return
  if (!validateBirthdate()) return
  if (!validateMasterPassword()) return
  return frm_personalSeed.reportValidity() && (notServiceForm || frm_serviceSeed.reportValidity())
}

async function generatePassword() {
  if (validateForms()) {
    const personalSeed = personalSeedHash
    const serviceSeed = normalizeInput(inp_service.value, inp_login.value)
    await passwordGenerator.setKey({personalSeed, serviceSeed})
    passwordGenerator.setIteration(+inp_iteration.value)
    listPassword(serviceSeed, +inp_iteration.value, await passwordGenerator.generatePassword())
  }
}

/** Includes code to fix stupid Firefox behaviour... */
function createFocusHandler(focusoutValidator) {
  return function() {
    if (!focusoutValidator) focusoutValidator = this.reportValidity
    const invalidInput = document.querySelector('input:invalid')
    if (invalidInput && invalidInput != this) {
      invalidInput.focus()
    } else {
      this.addEventListener('focusout', focusoutValidator, {once: true})
    }
  }
}
//#endregion

// const log = console.log
const [inp_person, inp_birthdate, inp_master] = document.getElementById('frm_personalSeed')
const {inp_service, inp_login, inp_iteration} = document.getElementById('frm_serviceSeed')
const           {frm_personalSeed,   frm_serviceSeed,   btn_downloadId,   btn_shred,   btn_generate,   inp_countdown} = 
getElementByIds('frm_personalSeed', 'frm_serviceSeed', 'btn_downloadId', 'btn_shred', 'btn_generate', 'inp_countdown')

initLightSwitch('css_light', 'btn_light')
navigator.serviceWorker.ready.then(registration => {
  navigator.serviceWorker.addEventListener('message', ({source, data}) => {
    switch (data.cmd) {
      case 'hello': document.getElementById('sw_build').innerText += ' '+data.build; break
    }
  })
  registration.active.postMessage({cmd: 'hi'})
})
registerServiceWorker('serviceWorker.js', {}, 'btn_install')

frm_personalSeed.onsubmit = (e) => {
  if (validateForms(true)) inp_service.focus()
  return false // do not submit (which would cause a reload)
}
inp_birthdate.onkeydown = (e) => {
  if (e.code == 'Enter') validateBirthdate() // to not call onsubmit if not valid
}
frm_serviceSeed.onsubmit = () => {return false}

for (const input of [inp_person, inp_birthdate, inp_master]) {
  input.addEventListener('input', personalSeedChange)
}
for (const input of [inp_service, inp_login, inp_iteration]) {
  input.addEventListener('input', resetShredderCountdown)
}
window.addEventListener("click", resetShredderCountdown)
btn_shred.addEventListener('click', () => location.reload())
btn_generate.addEventListener('click', generatePassword)
btn_downloadId.addEventListener('click', downloadFingerprint)
inp_person.addEventListener('focus', createFocusHandler())
inp_service.addEventListener('focus', createFocusHandler())
inp_birthdate.addEventListener('focus', createFocusHandler(validateBirthdate))
inp_master.addEventListener('focus', createFocusHandler(validateMasterPassword))

frm_serviceSeed.addEventListener('submit', () => btn_generate.click())

clearIdCanvas()
inp_countdown.value = inp_countdown.min // Firefox fix...
const passwordGenerator = new PasswordGenerator()
// listPassword('facebook', '0', '1234567890123456789012345')
