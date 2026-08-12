package com.appcontroller.agent;
import android.app.Activity;
import android.app.admin.DevicePolicyManager;
import android.content.*;
import android.os.Bundle;

public class DeviceAdminActivity extends Activity {
    @Override public void onCreate(Bundle b){
        super.onCreate(b);
        DevicePolicyManager d=(DevicePolicyManager)getSystemService(DEVICE_POLICY_SERVICE);
        ComponentName c=new ComponentName(this,AgentDeviceAdminReceiver.class);
        Intent i=new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
        i.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN,c);
        i.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION,"Allows the agent to lock this device when you explicitly request it.");
        startActivityForResult(i,10); finish();
    }
}
