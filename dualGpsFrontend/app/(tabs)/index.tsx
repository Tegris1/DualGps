import { useAuth } from "@/lib/auth-context";
import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "react-native-paper";

export default function Index() {
  const { signOut } = useAuth();
  return (
    <View style={styles.view}>
      <Text>Edit app/index.tsx to edit this screen.</Text>
      <Link href="/login" style={styles.navigationButton}>
        <Text>Login</Text>
      </Link>
      <Button
        mode="text"
        onPress={() => {
          signOut();
        }}
        icon="logout"
      >
        Sign Out
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  view: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  navigationButton: {
    marginTop: 20,
    borderWidth: 2,
    borderColor: "blue",
    width: 100,
    height: 30,
    textAlign: "center",
    borderRadius: 5,
    verticalAlign: "middle",
  },
});
