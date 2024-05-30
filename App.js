import { Text, SafeAreaView, StyleSheet, View, ScrollView } from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import { OpenAPI, UserService, KnowYourCustomerService, SourceOfFunds, IndividualStatus, UserType } from '@treklabs/api-web';

import React from 'react';

OpenAPI.WITH_CREDENTIALS = true;

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={{ paddingHorizontal: 16 }}>
        <UserLogin />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ecf0f1',
    paddingTop: 64,
  },
});

function UserLogin() {
  const [state, dispatch] = React.useReducer(loginReducer, {
    token: null,
    email: '',
    password: '',
    error: null,
    success: false,
    loading: false,
  });

  return (
    <View style={{ gap: 16 }}>
      <Text style={{ fontWeight: 'bold', textAlign: 'center' }}>Login</Text>
      <TextInput
        autoComplete="none"
        autoCorrect={false}
        autoCapitalize='none'
        inputMode="email"
        label="Email"
        value={state.email}
        onChangeText={(email) => {
          dispatch({ email });
        }}
      />
      <TextInput
        inputMode="password"
        secureTextEntry={true}
        label="Password"
        value={state.password}
        onChangeText={(text) => {
          dispatch({ password: text });
        }}
      />
      <Button
        disabled={!state.email || !state.password || state.loading}
        loading={state.loading}
        mode="contained"
        onPress={async () => {
          try {
            dispatch({ error: null, loading: true, success: false });
            const res = await UserService.loginRequest({
              email: state.email,
              password: state.password,
              organizationId: 1,
            });
            dispatch({ success: true, loading: false, token: res.token });
          } catch (error) {
            dispatch({ loading: false, error: String(error) });
          }
        }}>
        Login
      </Button>
      {state.success === true ? <OneTimePassword email={state.email} token={state.token} /> : null}
    </View>
  );
}

function OneTimePassword({token, email}) {
  const [state, dispatch] = React.useReducer(loginReducer, {
    otp: '',
    loading: false,
    success: false,
    error: null,
    showWebview: false,
    kycToken: null
  });

  if (state.showWebview) {
    return <SumSubWebView email={email} accessToken={state.kycToken} />
  }

  return (
    <View style={{ gap: 16 }}>
      <Text>Enter the password from your email or app (probably email):</Text>
      <TextInput
        label="One Time Password"
        value={state.otp}
        onChangeText={(otp) => {
          dispatch({ otp });
        }}
      />
      <Button
        disabled={!state.otp || state.loading}
        loading={state.loading}
        mode="contained"
        onPress={async () => {
          try {
            dispatch({ error: null, loading: true, success: false });
            const res = await UserService.loginConfirm({
              email,
              token,
              otp: state.otp,
              organizationId: 1,
            });

            OpenAPI.HEADERS = {
              "X-ACCESS-KEY": res.accessKey,
              "X-REFRESH-KEY": res.refreshKey,
              Cookie: "session=;",
            };

            await UserService.updateUser({
              firstName: "KYC TEST FIRST NAME",
              lastName: "KYC TEST LAST NAME",
              dob: "1990-05-30",
              countryCode: "AF",
              address: "123 KYC ADDRESS TEST",
              city: "Chicago",
              region: "IL",
              zipCode: "60005",
              employerName: "Backpack",
              employerAddress: "Backpack 123 Testing",
              sourceOfFunds: SourceOfFunds.SALARY,
              individualStatus: IndividualStatus.EMPLOYED,
              fatcaCompliance: true,
        userType: UserType.INDIVIDUAL,
            });

            const user = await UserService.getUser();
            console.log("user", user)

            const kycTokenRes = await KnowYourCustomerService.getKycToken();

            dispatch({ success: true, loading: false, token: res.token, showWebview: true, kycToken: kycTokenRes.token });
          } catch (error) {
            console.log('error', error)
            dispatch({ error: String(error), loading: false });
          }
        }}>
        Confirm Token
      </Button>
    </View>
  );
}

function SumSubWebView({email, accessToken}) {
  return (
    <View style={{ flex: 1 }} renderToHardwareTextureAndroid={true}>
      <WebView
        overScrollMode="never"
        startInLoadingState
        originWhitelist={['*']}
        // source={{ uri }}
        style={{
          flex: 1,
          opacity: 0.99,
        }}
        source={{ html: HTML(accessToken, email, 'dark', 'en') }}
        onMessage={(event) => {
          const { type, payload } = JSON.parse(event.nativeEvent.data);
          if (type === 'onApplicantStatusChanged') {
            if (payload?.reviewStatus !== 'init') {
              onComplete();
            }
          }

          if (type === 'onRequestNewToken') {
            // if (count < 3) {
            //   refetch();
            //   setCount((c) => c + 1);
            // }
          }
        }}
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        // iOS specific:
        allowsInlineMediaPlayback
        // Android specific:
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}

const HTML = (
  accessToken: string,
  email: string,
  theme: string,
  lang: string
) => `
<html>
 <head>
  <title>Backpack SumSub Mobile Webview</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
 </head>
 <body>
	<script src="https://static.sumsub.com/idensic/static/sns-websdk-builder.js"></script>
	<div id="sumsub-websdk-container" style="height: 100%; width:100%; display:flex;"></div>
</body>
</html>
<script>
const $ACCESS_TOKEN = "${accessToken}";
const $EMAIL = "${email}";
const $THEME = "${theme}";
const $LANG = "${lang}";

function launchWebSdk(accessToken, email, theme, lang) {
  let snsWebSdkInstance = snsWebSdk
    .init(accessToken, () => this.getNewAccessToken())
    .withConf({
      email: email,
      theme: theme,
      lang: lang,
    })
    .withOptions({ addViewportTag: false, adaptIframeHeight: true })
    .on("idCheck.onStepCompleted", (payload) => {
      const body = JSON.stringify({ type: "onStepCompleted", payload });
      window.ReactNativeWebView.postMessage(body);
    })
    .on("idCheck.onApplicationLoaded", (payload) => {
      const body = JSON.stringify({ type: "onApplicationLoaded" });
      window.ReactNativeWebView.postMessage(body);
    })
    .on("idCheck.onApplicantStatusChanged", (payload) => {
      const body = JSON.stringify({
        type: "onApplicantStatusChanged",
        payload: payload.reviewStatus,
      });
      window.ReactNativeWebView.postMessage(body);
    })
    .on("idCheck.onError", (error) => {
      const body = JSON.stringify({ type: "onError", payload: error });
      window.ReactNativeWebView.postMessage(body);
    })
    .onMessage((type, payload) => {
      console.log("message", type, payload);
    })
    .build();
  snsWebSdkInstance.launch("#sumsub-websdk-container");
}

function getNewAccessToken() {
  const body = JSON.stringify({ type: "onRequestNewToken" });
  window.ReactNativeWebView.postMessage(body);
  return Promise.resolve($ACCESS_TOKEN);
}

launchWebSdk($ACCESS_TOKEN, $EMAIL, $THEME, $LANG);
</script>
`;

function loginReducer(state, action) {
  return {
    ...state,
    ...action,
  };
}

function loginAction(body) {
  return fetch({
    method: 'POST',
    url: 'https://api.backpack.exchange/wapi/v1/user?mobile=true',
    body: JSON.stringify(body),
  });
}

function loginConfirmAction(body) {
  return fetch({
    method: 'POST',
    url: 'https://api.backpack.exchange/wapi/v1/user/login/confirm',
    body: JSON.stringify(body),
  });
}
