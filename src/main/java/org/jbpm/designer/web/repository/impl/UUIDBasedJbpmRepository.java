package org.jbpm.designer.web.repository.impl;

import org.jbpm.designer.web.preprocessing.impl.AbderaGuvnorHelper;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;

import org.apache.log4j.Logger;
import org.jbpm.designer.web.profile.IDiagramProfile;
import org.jbpm.designer.web.profile.impl.ExternalInfo;
import org.jbpm.designer.web.repository.IUUIDBasedRepository;
import org.apache.abdera.protocol.client.ClientResponse;
import org.apache.commons.io.IOUtils;

public class UUIDBasedJbpmRepository implements IUUIDBasedRepository {

    private static final Logger _logger = Logger.getLogger(UUIDBasedJbpmRepository.class);
    private final static String DEFAULTS_PATH = "defaults";
    
    private String _defaultsPath;
    
    public void configure(HttpServlet servlet) {
        _defaultsPath = servlet.getServletContext().getRealPath("/" + DEFAULTS_PATH);
    }

    public byte[] load(HttpServletRequest req, String uuid, IDiagramProfile profile) throws Exception {
        String processjson = "";
        String preProcessingParam = req.getParameter("pp");
        String securityToken = req.getParameter("securityToken");
        
        // check with Guvnor to see what it has for this uuid for us
        AbderaGuvnorHelper abderaGuvnorHelper = new AbderaGuvnorHelper(this.buildExternalLoadURL(profile, uuid), securityToken);
        ClientResponse response = abderaGuvnorHelper.invokeGET(this.buildExternalLoadURL(profile, uuid), "application/xml");
        
        String processxml = IOUtils.toString(response.getInputStream(),"UTF-8");
        if(processxml != null && processxml.length() > 0) {
            processjson = profile.createUnmarshaller().parseModel(processxml, profile, preProcessingParam);
            return processjson.getBytes("UTF-8");
        } else {
            return new byte[0];
        }
    }

    public void save(HttpServletRequest req, String uuid, String json,
            String svg, IDiagramProfile profile, Boolean autosave) {
        // Guvnor is responsible for saving 
    }
    
    private String buildExternalLoadURL(IDiagramProfile profile, String uuid) {
        StringBuilder buff = new StringBuilder();
        buff.append(ExternalInfo.getExternalProtocol(profile));
        
        buff.append("://");
        buff.append(ExternalInfo.getExternalHost(profile));
        buff.append("/");
        buff.append(profile.getExternalLoadURLSubdomain());
        buff.append("?uuid=").append(uuid);
        
        //usr and password still needed by Guvnor's internal authentication
        buff.append("&usr=").append(profile.getUsr());
        buff.append("&pwd=").append(profile.getPwd());
        
        return buff.toString();
    }
    
    public String toXML(String json, IDiagramProfile profile, String preProcessingData) {
        return profile.createMarshaller().parseModel(json, preProcessingData);
    }

    private String doHttpUrlConnectionAction(String desiredUrl) throws Exception {
      URL url = null;
      BufferedReader reader = null;
      StringBuilder stringBuilder;

      try {
        url = new URL(desiredUrl);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        
        connection.setRequestMethod("GET");
        connection.setRequestProperty("Content-Type", "application/xml"); 
        connection.setRequestProperty("charset", "UTF-8");
        //TODO: fix this
        connection.setRequestProperty("authorization", "admin");
        connection.setReadTimeout(5*1000);
        connection.connect();

        reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), "UTF-8"));
        stringBuilder = new StringBuilder();

        String line = null;
        while ((line = reader.readLine()) != null) {
          stringBuilder.append(line + "\n");
        }
        return stringBuilder.toString();
      } catch (Exception e) {
          _logger.error("Unable to connect to Gunvor. Is it running? [" + e.getMessage() + "]");
          // don't blow up, we will just show the default process
          return "";
      } finally {
        if (reader != null) {
          try {
            reader.close();
          } catch (IOException ioe) {
              _logger.error("Unable to read from Gunvor. [" + ioe.getMessage() + "]");
              // don't blow up, we will just show the default process
              return "";
          }
        }
      }
    }
}
