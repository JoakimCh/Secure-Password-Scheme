
# JLC's SPS PWA :lock:

> SPS as in Secure Password Scheme

> PWA as in Progressive Web Application (cross platform/device compatible)

## Description

An application to manage your passwords in a super secure way (accessible to all your devices) without needing to store them anywhere or sync any data; since they're procedurally generated (on demand) directly on your device. You only need to remember your master password and from it super strong passwords can be generated for every service you want to use with this scheme.

## Link to the app

https://joakimch.github.io/secure-password-scheme/

## About this project

This is actually my first PWA, I created it because I wanted such an app for myself. Because I'm tired of insecure ways of syncing passwords between devices and I don't trust third parties like e.g. LastPass (which got hacked)...

Please sponsor me [here on GitHub](https://github.com/sponsors/joakimch) if you like it. I am sick, without a job and could really need the money for my two kids...

## FAQ (please read before using)

### How are the passwords generated?

I'm utilizing [AES encryption](https://en.wikipedia.org/wiki/Advanced_Encryption_Standard) (which is trusted by the government and most internet traffic by the way) together with 256 bit keys derived from running the [PBKDF2 function](https://en.wikipedia.org/wiki/PBKDF2) on the input (making a bruteforce extremely much slower). This gives me a stream of cryptographically secure random bytes which I can use to generate totally random passwords in a deterministic way (as in the same input will always produce the same output).

### Can they be bruteforced?

> [Bruteforce](https://en.wikipedia.org/wiki/Brute-force_attack) is a method to programmatically try every combination until the right one is discovered. With lots of combinations it is not realistic to do in a timely manner (it could take eons).

The generated passwords are basically impossible to bruteforce, since they are 25 characters including upper case letters, numbers and symbols.

And your master password should also be near impossible since I require it to be minimum 8 characters which must include at least 1 upper case letter and 1 number. Together with your personal details it can not be bruteforced.

But... the weakest link in this security scheme IS your master password! And IF you make it easy to guess (e.g. by not using random characters) or someone somehow gets their hands on it; then your security is basically breached and you must change the passwords on any affected services to be certain that you're safe.

### What is the disadvantage of using this scheme?

As written above it is that if anyone knows your master password then this scheme offers no security, instead it actually makes you more vulnerable then (if you used it on lots of sites and anyone else who knows it also knows that you used it with this scheme and also knows your personal details).

### So what are the good use cases?

There are several! :sunglasses:

#### Avoid reuse of passwords

The most common use case is for a person who use the same password almost everywhere. Because if just one website used by that person is hacked and their password leaked then a hacker could get access to their accounts on the other sites. But if using SPS then every account will have a unique password and leaking any one of them would not compromise the security of the others.

#### Avoid using weak passwords

Another use case is for persons who often use weak passwords (e.g. because they're easy to remember). E.g. birth-dates, names or any word available in a dictionary (which would be prone to a [dictionary attack](https://en.wikipedia.org/wiki/Dictionary_attack)). Then it's better to let SPS generate unique super secure passwords for these accounts instead. And then you only need to remember one password, your master password.

#### Avoid insecure syncing of passwords and cumbersome software

Personally I use it to avoid having to sync passwords between devices using any insecure third-party services. Before I used Dropbox together with EncFS ([Encdroid](https://github.com/mrpdaemon/encdroid) on Android) to share an encrypted file between my devices. But today its hard to find useful or free software for doing this that works across my devices...

#### Keep any past and future passwords in sync with a selected few

A company (or any group of people) might want specific people (that they trust) to know which passwords are used here and there. And SPS could easily be used to do this without ever requiring syncing of data. Other than the personal details one important thing to agree on is which [naming convention](https://en.wikipedia.org/wiki/Naming_convention) to use for websites and services used with SPS. E.g. for Facebook should you use "facebook.com" or "facebook"? There is no need to worry about [case sensitivity](https://en.wikipedia.org/wiki/Case_sensitivity) though (since case is ignored).

### Offline password generation

If you're worried about [keyloggers](https://en.wikipedia.org/wiki/Keystroke_logging) or hackers snooping in on what you do on your device / computer then I recommend installing the app on a secure device that you keep private and offline. E.g. an old phone you don't use anymore (for maximum portability). The app has no problem working offline (unless you aggressively clear your browser cache).

### Business usage

For usage within a business or larger company I recommend the offline password generation I described above. But together with a trust structure where only a few people know enough to be able to generate the passwords and then to only share the generated passwords with people when they need to use them. E.g. when someone request access to an account they can signal such a person to get the password and preferably receive them using [any messaging app with support for self-destructing messages](https://www.popsci.com/send-self-destructing-messages/).

## Terms of agreement

If you use this application then do not hold me responsible for anything.

## ToDo list

- [ ] Firefox on Android doesn't show input validation errors ([the related Firefox bug](https://bugzilla.mozilla.org/show_bug.cgi?id=1510450)) and it has been 4 years without a fix. So I should implement a custom solution.
